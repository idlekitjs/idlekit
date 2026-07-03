import type { ResourceBag } from "./types";

/**
 * Pure {@link ResourceBag} helpers. None of them mutates its arguments: they
 * return fresh bags, so callers can reassign through their state accessors and
 * keep reactivity intact. Missing keys are treated as `0`.
 */

/** New bag with `delta` added entry by entry. */
export function addResources(bag: ResourceBag, delta: ResourceBag): ResourceBag {
  const result: ResourceBag = { ...bag };
  for (const [id, amount] of Object.entries(delta)) {
    result[id] = (result[id] ?? 0) + amount;
  }
  return result;
}

/** New bag with `cost` removed entry by entry (no clamping: check first). */
export function subtractResources(bag: ResourceBag, cost: ResourceBag): ResourceBag {
  const result: ResourceBag = { ...bag };
  for (const [id, amount] of Object.entries(cost)) {
    result[id] = (result[id] ?? 0) - amount;
  }
  return result;
}

/** True when `bag` covers every entry of `cost`. */
export function canAfford(bag: ResourceBag, cost: ResourceBag): boolean {
  for (const [id, amount] of Object.entries(cost)) {
    if ((bag[id] ?? 0) < amount) {
      return false;
    }
  }
  return true;
}

/** Shortfall per resource (`cost - bag`, only entries that are short). */
export function missingResources(bag: ResourceBag, cost: ResourceBag): ResourceBag {
  const missing: ResourceBag = {};
  for (const [id, amount] of Object.entries(cost)) {
    const shortfall = amount - (bag[id] ?? 0);
    if (shortfall > 0) {
      missing[id] = shortfall;
    }
  }
  return missing;
}
