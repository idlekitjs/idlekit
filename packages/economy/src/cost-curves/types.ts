import type { Cost } from "../amounts/types";
import type { EconomyReader } from "../economy/types";
import type { ResourceId } from "../resources/types";

/**
 * Per-unit price rounding, owned by the curve line (not by the resource, not
 * by the transaction). Rounding applies to *each unit's price* before summing,
 * so the displayed unit price and the total of N units always agree.
 */
export type Rounding = "none" | "floor" | "ceil" | "round";

export type CostCurveLine =
  | {
      kind: "flat";
      resourceId: ResourceId;
      /** Price per unit, independent of the owned count. */
      amount: number;
      round?: Rounding;
    }
  | {
      kind: "geometric";
      resourceId: ResourceId;
      /** Price of the very first unit (owned = 0). */
      baseAmount: number;
      /** Price multiplier per owned unit. Finite, > 0; `1` means linear. */
      growth: number;
      round?: Rounding;
    };

/**
 * A multi-resource price schedule anchored on an owned count. Usable anywhere
 * a price scales with a count: producers, upgrades, shop tiers, prestige...
 * The curve owns the pricing; settlement stays with transactions.
 */
export interface CostCurve<T> {
  /** Total cost of `quantity` consecutive units from the current owned count. */
  costFor(state: T, quantity: number): Cost;
  /** Cost of the next single unit. */
  next(state: T): Cost;
  /** Max whole units affordable right now across every line. */
  maxAffordable(state: T, economy: EconomyReader<T>): number;
}
