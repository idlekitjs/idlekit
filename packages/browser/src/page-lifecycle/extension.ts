import type { Extension } from "@idlekitjs/types";

/**
 * Page lifecycle bridge: translates the browser page's foreground/background
 * lifecycle into the engine's pause/resume contract.
 *
 * Pauses the loop when the tab/app goes to the background (to save battery) and
 * resumes on return, emitting `resume` with the elapsed background time so
 * `offline-progress` can credit it. This is the browser-coupled half that keeps
 * `@idlekitjs/core` headless — the core loop only exposes `pause()`/`resume()`.
 *
 * Today the implementation listens to the Page Visibility API
 * (`visibilitychange` / `document.hidden`); richer Page Lifecycle API signals
 * (`pagehide`, `freeze`, `resume`) can join later without renaming the brick.
 *
 * Opt-in: `engine.use(pageLifecycle())`. Safe in environments without
 * `document` (SSR/Node): it becomes a no-op.
 */
export function pageLifecycle<T extends object>(): Extension<T> {
  let handler: (() => void) | null = null;
  let hiddenAt = 0;

  return {
    id: "page-lifecycle",
    setup(engine) {
      if (typeof document === "undefined") {
        return;
      }
      handler = () => {
        if (document.hidden) {
          hiddenAt = Date.now();
          engine.pause();
          return;
        }
        if (hiddenAt > 0) {
          const elapsedMs = Date.now() - hiddenAt;
          hiddenAt = 0;
          engine.events.emit("resume", elapsedMs);
        }
        engine.resume();
      };
      document.addEventListener("visibilitychange", handler);
    },
    teardown() {
      if (handler && typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handler);
      }
      handler = null;
    },
  };
}
