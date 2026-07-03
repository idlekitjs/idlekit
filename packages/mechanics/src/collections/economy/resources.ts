import { readonly, recordField, type ResourceInit } from "@idlekitjs/economy";
import type { CollectibleEntry, CollectionData } from "../types";
import { cardLevelResourceId, cardShardResourceId } from "./ids";

export interface CollectionDataAccessors<T> {
  /** Read the live collection sub-state. */
  getData(state: T): CollectionData;
  /** Replace the collection sub-state (reassign for reactivity). */
  setData(state: T, data: CollectionData): void;
}

/**
 * Two resources per card:
 * - `card:<id>:shards` — the held copies (`CollectibleEntry.quantity`),
 *   writable: creditable as a reward, spendable in transactions. The entry is
 *   created on first write, so granting shards to a never-seen card just works;
 * - `card:<id>:level` — read-only observable, for requirements and display.
 *   Levels only move through the collection mechanic's `upgrade`, which stays
 *   the single source of truth for upgrade economics.
 *
 * Only the ids are read from the defs: the adapter never learns the cards
 * domain (rarities, effects, packs stay in the mechanic).
 */
export function cardResources<T>(
  collectibles: readonly { id: string }[],
  data: CollectionDataAccessors<T>,
): ResourceInit<T>[] {
  const inits: ResourceInit<T>[] = [];
  for (const card of collectibles) {
    inits.push({
      id: cardShardResourceId(card.id),
      integer: true,
      tags: ["card"],
      accessor: recordField<T, CollectibleEntry>({
        getRecord: (state) => data.getData(state).collectibles,
        setRecord: (state, collectibles) =>
          data.setData(state, { ...data.getData(state), collectibles }),
        key: card.id,
        field: "quantity",
        defaultEntry: () => ({ quantity: 0, level: 0 }),
      }),
    });
    inits.push({
      id: cardLevelResourceId(card.id),
      integer: true,
      tags: ["card"],
      accessor: readonly(
        (state) => data.getData(state).collectibles[card.id]?.level ?? 0,
      ),
    });
  }
  return inits;
}
