/**
 * Economy bridge for the pickups mechanic: collect actions as transactions.
 * The mechanic spawns opportunities; the reward exists only when a collect
 * transaction succeeds. Optional, like every economy bridge.
 *
 *   import { collectPickup } from "@idlekitjs/mechanics/pickups/economy";
 */
export { collectPickup } from "./collect";
export type { CollectPickupOptions } from "./collect";
export { pickupAvailable } from "./requirements";
