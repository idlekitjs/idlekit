import { createContext, useContext } from "react";
import type { Engine } from "@idlekitjs/core";

/**
 * Context holding the app-owned engine. Typed on the widest state (`object`);
 * the hooks narrow it back to the caller's state type.
 */
export const IdleKitContext = createContext<Engine<object> | null>(null);

/** Shared context read with a per-hook error message. */
export function useEngineFromContext<T extends object>(hookName: string): Engine<T> {
  const engine = useContext(IdleKitContext);
  if (engine === null) {
    throw new Error(`${hookName} must be used within an IdleKitProvider.`);
  }
  // Engine<T> is invariant in T (systems/extensions are stored internally), so
  // widening/narrowing across the context boundary needs an explicit hop.
  return engine as unknown as Engine<T>;
}
