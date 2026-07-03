import type { ResourceId } from "@idlekitjs/economy";

/** Resource id of a card's held copies (spendable on upgrades): `card:<id>:shards`. */
export function cardShardResourceId(id: string): ResourceId {
  return `card:${id}:shards`;
}

/** Resource id of a card's level (observable only): `card:<id>:level`. */
export function cardLevelResourceId(id: string): ResourceId {
  return `card:${id}:level`;
}
