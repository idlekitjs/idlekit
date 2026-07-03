import { computed, type ResourceId, type ResourceInit } from "@idlekitjs/economy";
import type { ResourceBag } from "../types";

export interface CraftingStockAccessors<T> {
  /** Read the live resource stock from the state. */
  getResources(state: T): ResourceBag;
  /** Reassign the resource stock into the state (keeps reactivity). */
  setResources(state: T, resources: ResourceBag): void;
  /** Map a bag key to a resource id (default: the key itself). */
  resourceId?: (key: string) => ResourceId;
  /** Display name per bag key (default: the resource id). */
  label?: (key: string) => string;
}

/**
 * Declare crafting stock entries as economy resources, pointed at the same
 * `ResourceBag` the mechanic consumes and credits. Crafting keeps paying
 * inputs, refunding cancels and crediting outputs internally — the bag is the
 * single source of truth, and the economy simply observes (and can trade)
 * the same balances. No second write path, no desync.
 */
export function craftingResources<T>(
  keys: readonly string[],
  stock: CraftingStockAccessors<T>,
): ResourceInit<T>[] {
  const idOf = stock.resourceId ?? ((key: string): ResourceId => key);
  return keys.map((key) => ({
    id: idOf(key),
    label: stock.label?.(key),
    accessor: computed<T>({
      get: (state) => stock.getResources(state)[key] ?? 0,
      add: (state, amount) => {
        const bag = stock.getResources(state);
        stock.setResources(state, { ...bag, [key]: (bag[key] ?? 0) + amount });
      },
    }),
  }));
}
