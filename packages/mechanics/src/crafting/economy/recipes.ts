import { normalizeAmounts, type AmountsInput, type Cost, type ResourceAmount, type ResourceId, type Reward } from "@idlekitjs/economy";
import type { RecipeDef, ResourceBag } from "../types";

/**
 * `ResourceBag` <-> amounts conversions. The bag stays the mechanic's state
 * and recipe shape; `Cost`/`Reward` are the transaction vocabulary — these
 * bridges avoid duplicating either.
 */

/** Bag entries as amount lines (zero entries dropped, keys mapped by `resourceId`). */
export function bagToAmounts(
  bag: ResourceBag,
  resourceId: (key: string) => ResourceId = (key) => key,
): ResourceAmount[] {
  const amounts: ResourceAmount[] = [];
  for (const [key, amount] of Object.entries(bag)) {
    if (amount !== 0) {
      amounts.push({ resourceId: resourceId(key), amount });
    }
  }
  return amounts;
}

/** Amount lines as a bag (normalized first: duplicates merged, zeros dropped). */
export function amountsToBag(
  amounts: AmountsInput,
  key: (id: ResourceId) => string = (id) => id,
): ResourceBag {
  const bag: ResourceBag = {};
  for (const line of normalizeAmounts(amounts)) {
    bag[key(line.resourceId)] = (bag[key(line.resourceId)] ?? 0) + line.amount;
  }
  return bag;
}

/** A recipe's inputs as a displayable/checkable cost. */
export function recipeCost(
  recipe: RecipeDef,
  resourceId?: (key: string) => ResourceId,
): Cost {
  return bagToAmounts(recipe.inputs, resourceId);
}

/** A recipe's outputs as a displayable reward. */
export function recipeReward(
  recipe: RecipeDef,
  resourceId?: (key: string) => ResourceId,
): Reward {
  return bagToAmounts(recipe.outputs, resourceId);
}
