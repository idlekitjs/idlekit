/**
 * Economy adapter for the collections mechanic: cards as resources
 * (`card:<id>:shards` writable, `card:<id>:level` read-only) and card-flavored
 * requirements. Upgrades stay owned by the mechanic (`collection.upgrade`),
 * which already carries the duplicates/currency economics and diagnostics —
 * this adapter never duplicates them.
 *
 *   import { cardResources, cardLevelAtLeast } from "@idlekitjs/mechanics/collections/economy";
 */
export { cardLevelResourceId, cardShardResourceId } from "./ids";
export { cardResources } from "./resources";
export type { CollectionDataAccessors } from "./resources";
export { cardLevelAtLeast, cardLevelBelow, hasCardShards } from "./requirements";
