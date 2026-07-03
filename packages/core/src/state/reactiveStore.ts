import type { StateKey, FlushListener } from "@idlekitjs/types";

/**
 * Proxy-based reactive state.
 *
 * The state is a plain data object (serializable as-is) wrapped in a Proxy that
 * only marks a key "dirty" when its value actually changes. No useless write is
 * propagated, which avoids the redundant DOM refreshes of the "redraw
 * everything every tick" model.
 *
 * The `get` trap also tracks dependencies: during a `track()` call, every key
 * that is read is recorded. The `Renderer` uses this to re-run only the
 * bindings whose actually-read keys have changed.
 *
 * Known limitation: only top-level keys are tracked. A deep mutation
 * (`state.list.push(x)`) does not mark the `list` key dirty; reassign instead
 * (`state.list = [...]`).
 */
export class ReactiveStore<T extends object> {
  /** Observable state. Mutate directly: `store.state.clips += 1`. */
  readonly state: T;

  private dirty = new Set<StateKey>();
  private readonly listeners = new Set<FlushListener>();
  /** Dependency collector active during a `track()` call (null otherwise). */
  private collecting: Set<StateKey> | null = null;

  constructor(initial: T) {
    this.state = new Proxy(initial, {
      get: (target, key) => {
        if (this.collecting !== null && typeof key !== "symbol") {
          this.collecting.add(key);
        }
        return Reflect.get(target, key);
      },
      set: (target, key, value) => {
        const current = Reflect.get(target, key);
        if (Object.is(current, value)) {
          return true;
        }
        Reflect.set(target, key, value);
        this.dirty.add(key);
        return true;
      },
      deleteProperty: (target, key) => {
        if (key in target) {
          Reflect.deleteProperty(target, key);
          this.dirty.add(key);
        }
        return true;
      },
    });
  }

  /** True if at least one key has changed since the last flush. */
  get isDirty(): boolean {
    return this.dirty.size > 0;
  }

  /**
   * Run `fn`, recording into `deps` every state key it reads. Restores the
   * previous collector on exit, even if `fn` throws (re-entrant).
   */
  track<R>(deps: Set<StateKey>, fn: () => R): R {
    const previous = this.collecting;
    this.collecting = deps;
    try {
      return fn();
    } finally {
      this.collecting = previous;
    }
  }

  /** Subscribe to changes. Returns an unsubscribe function. */
  subscribe(listener: FlushListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Notify subscribers of the changed keys, then reset tracking. */
  flush(): void {
    if (this.dirty.size === 0) {
      return;
    }
    const dirtyKeys = this.dirty;
    this.dirty = new Set();
    for (const listener of this.listeners) {
      listener(dirtyKeys);
    }
  }
}
