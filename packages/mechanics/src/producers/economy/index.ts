/**
 * Economy adapter for the producers mechanic. Official but opt-in: producers
 * itself never imports Economy, and this module never touches the mechanic's
 * internals — it only produces resource definitions, seam implementations and
 * transactions.
 *
 *   import { economyPurchase, producerResources } from "@idlekitjs/mechanics/producers/economy";
 */
export { producerResourceId } from "./ids";
export { producerOutput, producerResources } from "./resources";
export type { ProducerColumnAccessors } from "./resources";
export { economyPurchase } from "./purchase";
export type { EconomyPurchaseOptions } from "./purchase";
export { producerPurchase } from "./transactions";
export type { ProducerPurchaseOptions } from "./transactions";
