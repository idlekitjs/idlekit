import { EconomyError } from "@idlekitjs/economy";
import type { CostInput, Requirement, RewardInput, Transaction } from "@idlekitjs/economy";
import type { PickupItem, PickupsExtension } from "../types";
import { pickupAvailable } from "./requirements";

export interface CollectPickupOptions<T extends object> {
  itemId: string;
  /** Credited only when the whole transaction succeeds — never on spawn. */
  reward?: RewardInput<T>;
  /** Optional price of the collect action itself (energy, clicks, ...). */
  cost?: CostInput<T>;
  /** Extra gates, e.g. `containerHasSpace(bin, "scrap", 1)`. */
  requirements?: readonly Requirement<T>[];
  /** Domain effect after the item is taken, e.g. fill a container. */
  apply?: (state: T, item: PickupItem) => void;
  id?: string;
  label?: string;
}

/**
 * Collect a pickup as an economy transaction: availability (and any extra
 * requirement, typically container space) is checked in the pure preview;
 * only then is the item taken, the effect applied and the reward credited.
 * This is the piece that enforces "spawning creates an opportunity, the
 * reward exists only when the player successfully acts on it".
 */
export function collectPickup<T extends object>(
  pickups: PickupsExtension<T>,
  options: CollectPickupOptions<T>,
): Transaction<T> {
  return {
    id: options.id ?? `collect-pickup:${options.itemId}`,
    label: options.label,
    requirements: [pickupAvailable(pickups, options.itemId), ...(options.requirements ?? [])],
    cost: options.cost,
    reward: options.reward,
    apply: (state) => {
      const item = pickups.take(state, options.itemId);
      if (!item) {
        // Availability was a requirement, so preview vouched for the item;
        // failing here means something mutated between preview and apply.
        throw new EconomyError(
          `collectPickup: item "${options.itemId}" vanished between preview and apply.`,
        );
      }
      options.apply?.(state, item);
    },
  };
}
