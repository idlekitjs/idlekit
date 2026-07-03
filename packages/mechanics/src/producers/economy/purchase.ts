import { EconomyError, type Economy, type ResourceId } from "@idlekitjs/economy";
import type { ProducersOptions } from "../types";

export interface EconomyPurchaseOptions {
  /**
   * Treat a tier's budget as whole units: the budget is floored and payments
   * are ceiled to the next whole unit (safe: the mechanic guarantees
   * `spent <= budget`, and the floored budget is an integer). Defaults to the
   * resource's `integer` flag. AdVenture Communist style games pass
   * `(index) => index > 0`: fractional potatoes for tier 0, whole units of the
   * tier below for the rest.
   */
  wholeUnits?: (index: number) => boolean;
}

/**
 * Implement the producers scalar `purchase` seam on top of an economy: the
 * budget of tier `index` is the spendable balance of `resourceByTier(index)`,
 * and payments debit it. This does not replace the seam — games without
 * Economy keep writing their own `getBudget`/`pay` pair; games with Economy
 * get it in one line, and producers itself still never imports Economy.
 */
export function economyPurchase<T extends object>(
  economy: Economy<T>,
  resourceByTier: (index: number) => ResourceId,
  options: EconomyPurchaseOptions = {},
): NonNullable<ProducersOptions<T>["purchase"]> {
  const wholeUnits = (index: number): boolean =>
    options.wholeUnits
      ? options.wholeUnits(index)
      : economy.resource(resourceByTier(index)).integer;

  return {
    getBudget(state, index) {
      const id = resourceByTier(index);
      const available = economy.get(state, id) - economy.resource(id).min;
      return wholeUnits(index) ? Math.floor(available) : available;
    },
    pay(state, index, amount) {
      const id = resourceByTier(index);
      const price = wholeUnits(index) ? Math.ceil(amount) : amount;
      if (!economy.spend(state, id, price)) {
        // The mechanic never pays more than the budget it read; failing here
        // means the wiring lies (e.g. mismatched resource ids), so explode.
        throw new EconomyError(
          `Producers purchase of tier ${index} could not spend ${price} of "${id}".`,
        );
      }
    },
  };
}
