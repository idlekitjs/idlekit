import { EconomyError, type CostCurve, type Requirement, type Transaction } from "@idlekitjs/economy";
import type { ProducersExtension } from "../types";

export interface ProducerPurchaseOptions<T extends object> {
  producers: ProducersExtension<T>;
  /** Tier index in the producers definitions. */
  index: number;
  /**
   * Multi-resource price schedule (anchor `getOwned` on the tier's owned
   * count so the curve grows with the purchase history).
   */
  curve: CostCurve<T>;
  /** Whole units to buy (default 1). For "buy max", pass `curve.maxAffordable(...)`. */
  quantity?: number;
  id?: string;
  label?: string;
  requirements?: readonly Requirement<T>[];
}

/**
 * A composite producer purchase as an economy transaction: the cost comes from
 * the curve (any mix of flat and geometric lines, across any resources) and
 * the effect grants the units through `producers.grant(..., { owned: true })`,
 * so the tier's cost curve advances exactly as if the scalar seam had paid.
 *
 * This is the path for prices the scalar seam cannot express (e.g. Factory =
 * 1 collective + geometric coins + geometric science). Single-resource tiers
 * should keep the seam — it stays the fast path.
 */
export function producerPurchase<T extends object>(
  options: ProducerPurchaseOptions<T>,
): Transaction<T> {
  const quantity = Math.floor(options.quantity ?? 1);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new EconomyError(`producerPurchase needs a whole quantity >= 1, got ${options.quantity}.`);
  }
  return {
    id: options.id ?? `purchase-producer:${options.index}:${quantity}`,
    label: options.label,
    requirements: options.requirements,
    cost: (state) => options.curve.costFor(state, quantity),
    apply: (state) => {
      if (!options.producers.grant(options.index, state, quantity, { owned: true })) {
        throw new EconomyError(
          `producerPurchase could not grant ${quantity} unit(s) of tier ${options.index}.`,
        );
      }
    },
  };
}
