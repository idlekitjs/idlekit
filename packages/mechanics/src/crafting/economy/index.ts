/**
 * Economy adapter for the crafting mechanic: declare the crafting stock as
 * economy resources and convert recipe bags to costs/rewards for display and
 * transactions. Job/machine/duration lifecycle stays fully inside crafting;
 * start/cancel/complete keep mutating the bag directly.
 *
 *   import { craftingResources, recipeCost } from "@idlekitjs/mechanics/crafting/economy";
 */
export { craftingResources } from "./resources";
export type { CraftingStockAccessors } from "./resources";
export { amountsToBag, bagToAmounts, recipeCost, recipeReward } from "./recipes";
