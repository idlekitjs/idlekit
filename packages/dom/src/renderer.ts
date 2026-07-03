import type { Binding, StateKey } from "@idlekitjs/types";
import type { ReactiveStore } from "@idlekitjs/core";

interface Entry {
  binding: Binding;
  /** State keys read during the last `update()` (recomputed on each run). */
  deps: Set<StateKey>;
  initialized: boolean;
}

/**
 * Collection of bindings refreshed together (typically once per frame).
 *
 * Connected to a `ReactiveStore` via `connect()`, the renderer only runs a
 * binding when a state key it actually read has changed: each `update()` is
 * tracked to discover its dependencies, and only dirty keys trigger a re-run.
 * Without a connected store (or a non-connected renderer), `render()` falls back
 * to the simple "re-run everything" behavior.
 */
export class Renderer {
  private readonly entries: Entry[] = [];
  private readonly frameBindings: Binding[] = [];
  private store: ReactiveStore<object> | null = null;
  private unsubscribe: (() => void) | null = null;
  private readonly pendingDirty = new Set<StateKey>();

  /**
   * Connect the renderer to a store: only bindings whose read key changed are
   * re-run. Without a connection, `render()` re-runs everything (fallback).
   */
  connect<T extends object>(store: ReactiveStore<T>): void {
    this.disconnect();
    this.store = store as ReactiveStore<object>;
    this.unsubscribe = store.subscribe((dirty) => {
      for (const key of dirty) {
        this.pendingDirty.add(key);
      }
    });
  }

  /** Detach the store (bindings fall back to "re-run everything"). */
  disconnect(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.store = null;
    this.pendingDirty.clear();
  }

  /** Register a binding and return it. */
  add(binding: Binding): Binding {
    this.entries.push({ binding, deps: new Set(), initialized: false });
    return binding;
  }

  /** Register several bindings at once. */
  addAll(bindings: Binding[]): void {
    for (const binding of bindings) {
      this.add(binding);
    }
  }

  /**
   * Register a binding refreshed on *every* frame, bypassing dependency
   * tracking. Reserved for continuous animations (progress bars, timers) whose
   * source is mutated in place and so never marks a key dirty. Keep these few
   * and cheap: they defeat the dirty-key optimization by design.
   */
  addFrame(binding: Binding): Binding {
    this.frameBindings.push(binding);
    return binding;
  }

  /** Refresh the bindings affected by the changed keys, then the frame ones. */
  render(): void {
    const store = this.store;
    if (!store) {
      for (const entry of this.entries) {
        entry.binding.update();
      }
    } else {
      const dirty = this.pendingDirty;
      for (const entry of this.entries) {
        if (!entry.initialized) {
          entry.initialized = true;
          this.runTracked(store, entry);
        } else if (dirty.size > 0 && intersects(entry.deps, dirty)) {
          this.runTracked(store, entry);
        }
      }
      dirty.clear();
    }

    for (const binding of this.frameBindings) {
      binding.update();
    }
  }

  private runTracked(store: ReactiveStore<object>, entry: Entry): void {
    entry.deps.clear();
    store.track(entry.deps, () => entry.binding.update());
  }
}

/** True if the two sets share at least one key (iterates the smaller one). */
function intersects(a: ReadonlySet<StateKey>, b: ReadonlySet<StateKey>): boolean {
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  for (const key of small) {
    if (big.has(key)) {
      return true;
    }
  }
  return false;
}
