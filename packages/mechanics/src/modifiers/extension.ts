import type { Extension } from "@idlekitjs/types";
import { ModifierRegistry } from "./registry";

export interface ModifiersExtension<T extends object> extends Extension<T> {
  /** The shared registry that sources feed and consumers resolve against. */
  registry: ModifierRegistry;
}

/**
 * Modifiers hub: exposes a {@link ModifierRegistry}. Other plugins (collection)
 * or the game (projects) feed it; consumers (producers) resolve against it. The
 * dependency stays one-way and decoupled: nobody references a concrete source.
 */
export function modifiers<T extends object>(): ModifiersExtension<T> {
  return {
    id: "modifiers",
    registry: new ModifierRegistry(),
  };
}
