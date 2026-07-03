/**
 * `boosts` mechanic: temporary, stackable effects (@idlekitjs/mechanics/boosts).
 *
 * Integrates with `@idlekitjs/mechanics/modifiers` through an optional registry:
 * active boosts publish their effects under the source `boost:<id>`.
 */
export { boosts } from "./extension";
export type { BoostStacking, BoostDef, ActiveBoost, BoostsOptions, BoostsExtension } from "./types";
