import type { ReactiveStore } from "@idlekitjs/core";

/**
 * A monotonic version counter derived from a store's flush notifications.
 *
 * `engine.state` is a stable Proxy: its identity never changes, so it cannot
 * serve as the "changing snapshot" `useSyncExternalStore` needs. Instead, one
 * shared subscription per store bumps a number on every flush that reported
 * dirty keys, and hooks use that number as the snapshot.
 */
export interface VersionSource {
  subscribe(listener: () => void): () => void;
  getVersion(): number;
}

/**
 * One `VersionSource` per store, shared by every hook subscribed to the same
 * engine so N components cost a single `store.subscribe`. Keyed weakly: the
 * entry is released with the store.
 */
const versionSources = new WeakMap<ReactiveStore<object>, VersionSource>();

export function getVersionSource(store: ReactiveStore<object>): VersionSource {
  let source = versionSources.get(store);
  if (!source) {
    let version = 0;
    const listeners = new Set<() => void>();
    store.subscribe(() => {
      version += 1;
      for (const listener of [...listeners]) {
        listener();
      }
    });
    source = {
      getVersion: () => version,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    };
    versionSources.set(store, source);
  }
  return source;
}
