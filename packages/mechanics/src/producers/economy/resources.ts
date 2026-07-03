import { arrayIndex, type Economy, type ResourceAccessor, type ResourceId, type ResourceInit } from "@idlekitjs/economy";
import type { ProducerColumn, ProducerDef } from "../types";
import { producerResourceId } from "./ids";

export interface ProducerColumnAccessors<T> {
  /** Read the live producer arrays from the state. */
  getColumn(state: T): ProducerColumn;
  /** Reassign the given arrays into the state (keeps reactivity). */
  setColumn(state: T, patch: Partial<ProducerColumn>): void;
}

/**
 * One resource per producer tier, over `total` (the spendable pool of units,
 * the same one the tier-consuming purchase rule debits). Balances can be
 * fractional (production multipliers leave fractions), so the resources are
 * deliberately not `integer`; whole-unit purchase semantics live in
 * {@link economyPurchase}.
 */
export function producerResources<T>(
  defs: readonly ProducerDef[],
  column: ProducerColumnAccessors<T>,
): ResourceInit<T>[] {
  return defs.map((def, index) => ({
    id: producerResourceId(def.id),
    label: def.id,
    accessor: arrayIndex<T>({
      getArray: (state) => column.getColumn(state).total,
      setArray: (state, total) => column.setColumn(state, { total }),
      index,
    }),
    tags: def.tags,
  }));
}

/**
 * Bridge an economy resource into the producers `resource` seam (tier 0
 * output / default purchase currency), so production credits and the economy
 * observe the same balance. Prefer a non-`integer` resource here: production
 * ticks credit fractional amounts.
 */
export function producerOutput<T>(economy: Economy<T>, resourceId: ResourceId): ResourceAccessor<T> {
  return {
    get: (state) => economy.get(state, resourceId),
    add: (state, amount) => {
      economy.add(state, resourceId, amount);
    },
  };
}
