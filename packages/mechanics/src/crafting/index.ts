/**
 * `crafting` mechanic: timed resource transformation over machines
 * (@idlekitjs/mechanics/crafting).
 *
 * The ResourceBag helpers are public helpers of this mechanic: they are
 * surfaced only through this module, never as their own subpath.
 */
export { crafting } from "./extension";
export { addResources, subtractResources, canAfford, missingResources } from "./resources";
export type {
  ResourceBag,
  RecipeDef,
  MachineDef,
  CraftingJob,
  CraftingStatus,
  CraftingOptions,
  CraftingExtension,
} from "./types";
