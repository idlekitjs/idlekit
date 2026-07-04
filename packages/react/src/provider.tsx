import type { JSX, ReactNode } from "react";
import type { Engine } from "@idlekitjs/core";
import { IdleKitContext } from "./internal/context";

/**
 * Provides an engine to the component tree.
 *
 * The engine is created by the app (`createEngine` from `@idlekitjs/core`) and
 * passed in as-is: the provider stores the reference directly on context —
 * no wrapper object, no lifecycle policy. Starting, stopping, and disposing
 * the engine remain the app's responsibility.
 */
export function IdleKitProvider<T extends object>(props: {
  engine: Engine<T>;
  children: ReactNode;
}): JSX.Element {
  return (
    <IdleKitContext.Provider value={props.engine as unknown as Engine<object>}>
      {props.children}
    </IdleKitContext.Provider>
  );
}
