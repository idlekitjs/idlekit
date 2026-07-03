import type { Requirement } from "@idlekitjs/economy";
import type { PickupsExtension } from "../types";

/**
 * Requirement: the item exists and is not expired. Guards collect
 * transactions against double-clicks and just-expired items — the failure is
 * a normal `requirement-failed` diagnostic, never a throw.
 */
export function pickupAvailable<T extends object>(
  pickups: PickupsExtension<T>,
  itemId: string,
): Requirement<T> {
  return {
    id: `pickup-available:${itemId}`,
    isMet: (state) => pickups.status(state, itemId).kind === "ready",
  };
}
