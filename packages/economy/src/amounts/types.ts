import type { ResourceId } from "../resources/types";

/** One line of a cost or reward: `amount` units of `resourceId`. */
export interface ResourceAmount {
  resourceId: ResourceId;
  amount: number;
}

/**
 * Normalized amounts: unique resource ids, finite amounts strictly greater
 * than zero. `Cost` and `Reward` share the same shape on purpose (one
 * implementation, two readable names): a cost is what a transaction consumes,
 * a reward what it credits — negative lines are invalid on both sides.
 */
export type Cost = readonly ResourceAmount[];
export type Reward = readonly ResourceAmount[];

/**
 * Author-facing input: tuples (`["currency:science", 500]`) or objects
 * (`{ resourceId, amount }`), freely mixed. Duplicates are merged by sum and
 * zero lines dropped during normalization.
 */
export type AmountsInput = readonly (readonly [ResourceId, number] | ResourceAmount)[];
