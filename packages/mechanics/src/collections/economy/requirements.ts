import type { Requirement } from "@idlekitjs/economy";
import { cardLevelResourceId, cardShardResourceId } from "./ids";

/**
 * Card-flavored requirement factories, built on the resources declared by
 * `cardResources` (they assume those are registered in the checking economy).
 */

/** Met when the card's level is at least `level`. */
export function cardLevelAtLeast<T>(cardId: string, level: number): Requirement<T> {
  const resourceId = cardLevelResourceId(cardId);
  return {
    id: `card-level-at-least:${cardId}:${level}`,
    isMet: (state, economy) => economy.get(state, resourceId) >= level,
    progress: (state, economy) => ({
      current: economy.get(state, resourceId),
      target: level,
    }),
  };
}

/** Met while the card's level is strictly below `level` (e.g. "not maxed"). */
export function cardLevelBelow<T>(cardId: string, level: number): Requirement<T> {
  const resourceId = cardLevelResourceId(cardId);
  return {
    id: `card-level-below:${cardId}:${level}`,
    isMet: (state, economy) => economy.get(state, resourceId) < level,
  };
}

/** Met when at least `count` shards of the card are held (not consumed). */
export function hasCardShards<T>(cardId: string, count: number): Requirement<T> {
  const resourceId = cardShardResourceId(cardId);
  return {
    id: `has-card-shards:${cardId}:${count}`,
    isMet: (state, economy) => economy.get(state, resourceId) >= count,
    progress: (state, economy) => ({
      current: economy.get(state, resourceId),
      target: count,
    }),
  };
}
