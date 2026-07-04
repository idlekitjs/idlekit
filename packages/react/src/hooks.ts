import { useEffect, useRef } from "react";
import useSyncExternalStoreExports from "use-sync-external-store/shim/with-selector";
import type { Engine, ReactiveStore, EngineEvents } from "@idlekitjs/core";
import { useEngineFromContext } from "./internal/context";
import { getVersionSource } from "./internal/version-source";

// CJS interop: `use-sync-external-store` is CommonJS-only, so the named export
// is destructured from the default-imported module object (works in both Node
// ESM and bundlers). Same pattern as zustand / react-redux.
const { useSyncExternalStoreWithSelector } = useSyncExternalStoreExports;

/**
 * Returns the engine from the nearest {@link IdleKitProvider}.
 *
 * Throws a descriptive error when used outside a provider. Use it in event
 * handlers to mutate state (`engine.state.coins += 1`) or to reach engine
 * APIs (`engine.events`, `engine.advance`, ...).
 */
export function useIdleKitEngine<T extends object>(): Engine<T> {
  return useEngineFromContext<T>("useIdleKitEngine");
}

/**
 * Subscribes to a selected slice of the engine state.
 *
 * The selector re-runs after each store flush (the engine flushes once per
 * frame, and only when at least one top-level key changed); the component only
 * re-renders when the selected value changes according to `isEqual`
 * (default: `Object.is`). Selectors returning fresh objects/arrays should pass
 * a structural `isEqual` to avoid re-rendering on every flush.
 *
 * Note: the core store tracks top-level keys only. A deep mutation
 * (`state.resources.coins++`) does not mark `resources` dirty and will not
 * notify; reassign the top-level key instead (`state.resources = { ... }`).
 * This limitation is shared with the `@idlekitjs/dom` bindings.
 */
export function useIdleKitSelector<T extends object, R>(
  selector: (state: T) => R,
  isEqual: (a: R, b: R) => boolean = Object.is,
): R {
  const engine = useEngineFromContext<T>("useIdleKitSelector");
  const source = getVersionSource(engine.store as ReactiveStore<object>);
  return useSyncExternalStoreWithSelector(
    source.subscribe,
    source.getVersion,
    // Server snapshot: same static version; the selector below reads the
    // headless engine state once. Safe as long as the loop is not started
    // server-side (this package never starts it).
    source.getVersion,
    () => selector(engine.state),
    isEqual,
  );
}

/**
 * Subscribes a handler to an engine event (`engine.events.on`) for the
 * lifetime of the component, unsubscribing on unmount.
 *
 * The latest handler is kept in a ref, so callers do not need `useCallback`:
 * a new handler identity on each render does not resubscribe.
 */
export function useIdleKitEvent<K extends keyof EngineEvents>(
  type: K,
  handler: (payload: EngineEvents[K]) => void,
): void {
  const engine = useEngineFromContext("useIdleKitEvent");
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });
  useEffect(() => {
    return engine.events.on(type, (payload) => {
      handlerRef.current(payload);
    });
  }, [engine, type]);
}
