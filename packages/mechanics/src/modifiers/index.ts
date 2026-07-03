/**
 * `modifiers` mechanic: shared bonus registry (@idlekitjs/mechanics/modifiers).
 *
 * `ModifierRegistry` is a public helper of this mechanic: it is surfaced only
 * through this module, never as its own subpath.
 */
export { modifiers } from "./extension";
export type { ModifiersExtension } from "./extension";
export { ModifierRegistry } from "./registry";
export type { Modifier, ModifierTarget, ResolveQuery } from "./types";
