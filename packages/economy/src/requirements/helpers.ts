import type { ResourceId } from "../resources/types";
import type { Requirement } from "./types";

/**
 * Generic, domain-free requirement factories. Domain-specific helpers
 * (card levels, producer counts...) belong to the mechanics' economy adapters,
 * not here — Economy must never learn a gameplay domain.
 *
 * The resource-based helpers assume the resource is registered in the economy
 * that checks them; an unknown id throws (programming error).
 */

/** Met when the balance of `resourceId` is at least `amount` (not consumed). */
export function resourceAtLeast<T>(resourceId: ResourceId, amount: number): Requirement<T> {
  return {
    id: `resource-at-least:${resourceId}:${amount}`,
    isMet: (state, economy) => economy.get(state, resourceId) >= amount,
    progress: (state, economy) => ({
      current: economy.get(state, resourceId),
      target: amount,
    }),
  };
}

/** Met when the balance of `resourceId` is at most `amount`. */
export function resourceAtMost<T>(resourceId: ResourceId, amount: number): Requirement<T> {
  return {
    id: `resource-at-most:${resourceId}:${amount}`,
    isMet: (state, economy) => economy.get(state, resourceId) <= amount,
  };
}

/** Met when every given requirement is met. */
export function allOf<T>(...requirements: readonly Requirement<T>[]): Requirement<T> {
  return {
    id: `all-of:${requirements.map((requirement) => requirement.id).join("+")}`,
    isMet: (state, economy) =>
      requirements.every((requirement) => requirement.isMet(state, economy)),
  };
}

/** Met when the given requirement is not. */
export function not<T>(requirement: Requirement<T>, label?: string): Requirement<T> {
  return {
    id: `not:${requirement.id}`,
    label,
    isMet: (state, economy) => !requirement.isMet(state, economy),
  };
}
