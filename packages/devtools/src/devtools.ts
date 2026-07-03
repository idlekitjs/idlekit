import type { EngineContext, Extension } from "@idlekitjs/types";
import type { SaveManager } from "@idlekitjs/core";
import { DevMetrics } from "./metrics";

export interface DevtoolsOptions<T extends object> {
  /** Save manager, enabling the "Save now" and "Wipe data" actions. */
  save?: SaveManager<T>;
  /**
   * Tear the game down before a wipe (e.g. `() => engine.dispose()`). Required for
   * "Wipe data" to stick: it stops the loop and the autosave lifecycle
   * listeners, otherwise the `pagehide`/`visibilitychange` save fires during the
   * reload and immediately rewrites the state we just cleared.
   */
  dispose?: () => void;
  /** Extra rows to display, recomputed on each refresh (values are stringified). */
  stats?: (state: T) => Record<string, unknown>;
  /** Key (KeyboardEvent.key) that toggles the overlay. Default: "`". */
  hotkey?: string;
  /** Start expanded. Default: true. */
  open?: boolean;
  /** Panel text refresh interval in ms. Default: 200. */
  refreshMs?: number;
}

export interface DevtoolsExtension<T extends object> extends Extension<T> {
  /** Live metrics (exposed for inspection / tests). */
  readonly metrics: DevMetrics;
}

const STYLE_ID = "idlekit-devtools-style";

const CSS = `
.idlekit-devtools {
  position: fixed; right: 8px; bottom: 8px; z-index: 2147483647;
  font: 11px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: #d8f5d8; background: rgba(10, 14, 11, 0.9);
  border: 1px solid #2a3a2a; border-radius: 8px;
  min-width: 188px; max-width: 300px;
  -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
  user-select: none; box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
}
.idlekit-devtools[hidden] { display: none; }
.idlekit-devtools-header {
  display: flex; justify-content: space-between; align-items: center;
  gap: 8px; padding: 6px 8px; cursor: pointer; border-bottom: 1px solid #2a3a2a;
}
.idlekit-devtools-title { font-weight: 700; color: #7cfc7c; letter-spacing: 0.04em; }
.idlekit-devtools-caret { color: #6a8a6a; }
.idlekit-devtools-body { padding: 6px 8px; display: flex; flex-direction: column; gap: 6px; }
.idlekit-devtools.is-collapsed .idlekit-devtools-body { display: none; }
.idlekit-devtools pre { margin: 0; white-space: pre; font: inherit; }
.idlekit-devtools-actions { display: flex; gap: 6px; }
.idlekit-devtools button {
  flex: 1; font: inherit; cursor: pointer; padding: 4px 8px;
  color: #d8f5d8; background: #16201a; border: 1px solid #2a3a2a; border-radius: 5px;
}
.idlekit-devtools button:hover { background: #1f2e24; }
.idlekit-devtools button.danger { color: #ffb3b3; border-color: #5a2a2a; }
.idlekit-devtools button.danger:hover { background: #2e1a1a; }
`;

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/** Pad a label and append a value, for column-aligned rows. */
function row(label: string, value: unknown): string {
  return `${label.padEnd(9)}${String(value)}`;
}

function formatUptime(seconds: number): string {
  const s = Math.floor(seconds) % 60;
  const m = Math.floor(seconds / 60) % 60;
  const h = Math.floor(seconds / 3600);
  const mm = `${m}`.padStart(2, "0");
  const ss = `${s}`.padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Development overlay plugin: a small fixed panel showing the live frame rate,
 * the measured tick rate, uptime and game-supplied stats, with one-click
 * "Save now" and "Wipe data" actions. Toggle with the hotkey (default backtick).
 *
 * Self-contained (injects its own styles) and a no-op outside the browser, so it
 * is safe to register unconditionally; gate it behind a dev flag to keep it out
 * of production bundles.
 */
export function devtools<T extends object>(options: DevtoolsOptions<T> = {}): DevtoolsExtension<T> {
  const metrics = new DevMetrics();
  const refreshMs = options.refreshMs ?? 200;
  const hotkey = options.hotkey ?? "`";

  let engine: EngineContext<T> | null = null;
  let root: HTMLElement | null = null;
  let pre: HTMLElement | null = null;
  let onKey: ((event: KeyboardEvent) => void) | null = null;
  let startMs = now();
  let lastRefresh = 0;

  function injectStyle(): void {
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function button(label: string, danger: boolean, onClick: () => void): HTMLButtonElement {
    const el = document.createElement("button");
    el.type = "button";
    el.textContent = label;
    if (danger) {
      el.classList.add("danger");
    }
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      onClick();
    });
    return el;
  }

  function mount(): void {
    injectStyle();

    root = document.createElement("div");
    root.className = "idlekit-devtools";
    if (options.open === false) {
      root.classList.add("is-collapsed");
    }

    const header = document.createElement("div");
    header.className = "idlekit-devtools-header";
    const title = document.createElement("span");
    title.className = "idlekit-devtools-title";
    title.textContent = "idlekit devtools";
    const caret = document.createElement("span");
    caret.className = "idlekit-devtools-caret";
    caret.textContent = "[~]";
    header.append(title, caret);
    header.addEventListener("click", () => root?.classList.toggle("is-collapsed"));

    const body = document.createElement("div");
    body.className = "idlekit-devtools-body";
    pre = document.createElement("pre");
    body.appendChild(pre);

    if (options.save) {
      const actions = document.createElement("div");
      actions.className = "idlekit-devtools-actions";
      actions.append(
        button("Save", false, () => {
          if (options.save && engine) {
            void options.save.save(engine.state);
          }
        }),
        button("Wipe", true, () => {
          if (!options.save) {
            return;
          }
          const ok =
            typeof window === "undefined" ||
            window.confirm("Wipe all saved data? This cannot be undone.");
          if (!ok) {
            return;
          }
          // Stop the loop and autosave listeners first, so the reload below does
          // not trigger a lifecycle save that rewrites the cleared state.
          options.dispose?.();
          void Promise.resolve(options.save.clear()).then(() => {
            if (typeof location !== "undefined") {
              location.reload();
            }
          });
        }),
      );
      body.appendChild(actions);
    }

    root.append(header, body);
    document.body.appendChild(root);

    onKey = (event: KeyboardEvent) => {
      if (event.key === hotkey && root) {
        root.hidden = !root.hidden;
      }
    };
    window.addEventListener("keydown", onKey);

    refresh();
  }

  function refresh(): void {
    if (!pre) {
      return;
    }
    const lines = [
      row("FPS", metrics.fps.toFixed(1)),
      row("TICK/s", `${metrics.tickRate.toFixed(0)}  (${metrics.totalTicks})`),
      row("UPTIME", formatUptime((now() - startMs) / 1000)),
    ];
    if (options.stats && engine) {
      lines.push("\u2500".repeat(20));
      const stats = options.stats(engine.state);
      for (const key of Object.keys(stats)) {
        lines.push(row(key, stats[key]));
      }
    }
    pre.textContent = lines.join("\n");
  }

  return {
    id: "devtools",
    metrics,

    setup(context) {
      engine = context;
      startMs = now();
      if (typeof document !== "undefined") {
        mount();
      }
    },

    update() {
      metrics.recordTick();
    },

    render() {
      metrics.recordFrame(now());
      const t = now();
      if (pre && t - lastRefresh >= refreshMs) {
        lastRefresh = t;
        refresh();
      }
    },

    teardown() {
      if (onKey && typeof window !== "undefined") {
        window.removeEventListener("keydown", onKey);
      }
      root?.remove();
      root = null;
      pre = null;
      onKey = null;
    },
  };
}
