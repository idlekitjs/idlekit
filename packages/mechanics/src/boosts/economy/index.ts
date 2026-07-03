/**
 * Economy adapter for the boosts mechanic, deliberately thin: a token id
 * convention and an activation transaction. Boosts stay independent of
 * Economy; rewards grant tokens, transactions spend them and `grant` a boost.
 *
 *   import { activateBoost, boostTokenResourceId } from "@idlekitjs/mechanics/boosts/economy";
 */
export { activateBoost, boostTokenResourceId } from "./tokens";
export type { ActivateBoostOptions } from "./tokens";
