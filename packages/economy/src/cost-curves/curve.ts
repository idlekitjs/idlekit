import { finiteOr } from "@idlekitjs/utils";
import type { Cost, ResourceAmount } from "../amounts/types";
import { EconomyError } from "../economy/errors";
import type { ResourceId } from "../resources/types";
import { geometricAffordable, geometricSum } from "./geometric-math";
import { validateLine } from "./lines";
import type { CostCurve, CostCurveLine, Rounding } from "./types";

export interface CostCurveOptions<T> {
  /** Units already purchased: anchors where every geometric line prices from. */
  getOwned: (state: T) => number;
  lines: readonly CostCurveLine[];
}

/**
 * Build a multi-resource cost curve. Pricing rules:
 * - flat lines cost `amount` per unit, regardless of the owned count;
 * - geometric lines price unit `owned + k` at `baseAmount * growth^(owned+k)`;
 * - `round` applies to each unit's price before summing, so unit price and
 *   bulk totals always agree. Exact closed forms are used when `round` is
 *   "none"; rounded geometric sums iterate (with a budget cutoff internally).
 *
 * `maxAffordable` reads spendable balances (balance minus the resource `min`)
 * through the economy and returns the largest whole quantity every line can
 * cover, merging lines that share a resource.
 */
export function costCurve<T>(options: CostCurveOptions<T>): CostCurve<T> {
  for (const line of options.lines) {
    validateLine(line);
    if (line.kind === "geometric" && line.growth < 1 && isRounded(line.round)) {
      // Rounded decreasing curves have degenerate tails (floored prices reach
      // zero); nothing in the genre needs them, so they fail fast instead.
      throw new EconomyError(
        `Geometric cost line for "${line.resourceId}": per-unit rounding requires growth >= 1.`,
      );
    }
  }

  const ownedOf = (state: T): number => Math.floor(finiteOr(options.getOwned(state), 0));

  const groups = new Map<ResourceId, CostCurveLine[]>();
  for (const line of options.lines) {
    const group = groups.get(line.resourceId);
    if (group) {
      group.push(line);
    } else {
      groups.set(line.resourceId, [line]);
    }
  }

  function costFor(state: T, quantity: number): Cost {
    if (!Number.isFinite(quantity)) {
      return [];
    }
    const count = Math.min(Math.floor(quantity), Number.MAX_SAFE_INTEGER);
    if (count <= 0) {
      return [];
    }
    const owned = ownedOf(state);
    const cost: ResourceAmount[] = [];
    for (const [resourceId, group] of groups) {
      let amount = 0;
      for (const line of group) {
        amount += lineCostFor(line, owned, count);
      }
      if (amount > 0) {
        cost.push({ resourceId, amount });
      }
    }
    return cost;
  }

  return {
    costFor,
    next: (state) => costFor(state, 1),
    maxAffordable: (state, economy) => {
      const owned = ownedOf(state);
      let best = Number.MAX_SAFE_INTEGER;
      for (const [resourceId, group] of groups) {
        const def = economy.resource(resourceId);
        const budget = economy.get(state, resourceId) - def.min;
        best = Math.min(best, groupAffordable(group, owned, budget));
        if (best === 0) {
          return 0;
        }
      }
      return best;
    },
  };
}

function isRounded(round: Rounding | undefined): boolean {
  return round !== undefined && round !== "none";
}

function roundWith(round: Rounding | undefined, value: number): number {
  switch (round) {
    case "floor":
      return Math.floor(value);
    case "ceil":
      return Math.ceil(value);
    case "round":
      return Math.round(value);
    default:
      return value;
  }
}

/**
 * Total price of `quantity` units of one line starting after `owned`. The
 * optional `stopAbove` lets affordability searches bail out as soon as the
 * running total exceeds the budget, keeping iterative sums bounded.
 */
function lineCostFor(
  line: CostCurveLine,
  owned: number,
  quantity: number,
  stopAbove = Infinity,
): number {
  if (quantity <= 0) {
    return 0;
  }
  if (line.kind === "flat") {
    return roundWith(line.round, line.amount) * quantity;
  }
  const first = line.baseAmount * Math.pow(line.growth, owned);
  if (!isRounded(line.round)) {
    return geometricSum(first, line.growth, quantity);
  }
  // A free geometric line stays free at every count: skip the iteration.
  if (first <= 0) {
    return 0;
  }
  let total = 0;
  let price = first;
  for (let k = 0; k < quantity; k++) {
    total += roundWith(line.round, price);
    if (!Number.isFinite(total) || total > stopAbove) {
      return total;
    }
    price *= line.growth;
  }
  return total;
}

/** Max units a single line affords with `budget`. */
function lineAffordable(line: CostCurveLine, owned: number, budget: number): number {
  if (!Number.isFinite(budget) || budget <= 0) {
    return 0;
  }
  if (line.kind === "flat") {
    const unit = roundWith(line.round, line.amount);
    if (unit <= 0) {
      return Number.MAX_SAFE_INTEGER;
    }
    return budget < unit ? 0 : Math.min(Math.floor(budget / unit), Number.MAX_SAFE_INTEGER);
  }

  const first = line.baseAmount * Math.pow(line.growth, owned);
  if (!isRounded(line.round) || line.growth === 1) {
    // growth == 1 with rounding is still a constant unit price: exact division.
    if (line.growth === 1 && isRounded(line.round)) {
      const unit = roundWith(line.round, first);
      if (unit <= 0) {
        return Number.MAX_SAFE_INTEGER;
      }
      return budget < unit ? 0 : Math.min(Math.floor(budget / unit), Number.MAX_SAFE_INTEGER);
    }
    return geometricAffordable(first, line.growth, budget);
  }

  // Rounded, growing line: bracket with the unrounded inverse. Per-unit
  // rounding shifts each price by less than 1, so `n` units shift the total by
  // less than `n`; iterating the inverse on an enlarged budget converges to a
  // safe upper bound because the series grows geometrically while the slack
  // grows linearly.
  let hi = geometricAffordable(first, line.growth, budget);
  for (let i = 0; i < 4; i++) {
    hi = geometricAffordable(first, line.growth, budget + hi + 1);
  }
  hi += 2;
  return maxCountWithin((count) => lineCostFor(line, owned, count, budget), budget, hi);
}

/** Max units a group of same-resource lines affords with `budget`. */
function groupAffordable(
  group: readonly CostCurveLine[],
  owned: number,
  budget: number,
): number {
  if (group.length === 1) {
    return lineAffordable(group[0], owned, budget);
  }
  // Each line alone costs no more than the group: the cheapest single-line
  // affordability bounds the search.
  let hi = Number.MAX_SAFE_INTEGER;
  for (const line of group) {
    hi = Math.min(hi, lineAffordable(line, owned, budget));
  }
  const cost = (count: number): number => {
    let total = 0;
    for (const line of group) {
      total += lineCostFor(line, owned, count, budget);
      if (total > budget) {
        return total;
      }
    }
    return total;
  };
  return maxCountWithin(cost, budget, hi);
}

/**
 * Largest `count` in `[0, hi]` with `cost(count) <= budget`, by binary search.
 * `cost` must be non-decreasing; `cost(0)` is 0 by construction.
 */
function maxCountWithin(cost: (count: number) => number, budget: number, hi: number): number {
  if (hi <= 0) {
    return 0;
  }
  if (cost(hi) <= budget) {
    return hi;
  }
  let lo = 0;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (cost(mid) <= budget) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return lo;
}
