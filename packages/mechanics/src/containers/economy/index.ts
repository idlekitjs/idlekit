/**
 * Economy bridge for the containers mechanic: capacity gates as requirements,
 * container contents/free space as resources, and one-call bag <-> container
 * transfers. The mechanic stays the source of truth for capacity; Economy never
 * owns it.
 *
 *   import { containerHasSpace } from "@idlekitjs/mechanics/containers/economy";
 */
export { containerHasSpace } from "./requirements";
export { containerContentResources, containerFreeSpaceResource } from "./resources";
export { transferBagToContainer, transferContainerToBag } from "./transfers";
export type {
  BagAccessor,
  ResourceBag,
  TransferBlock,
  TransferMode,
  TransferOptions,
  TransferResult,
} from "./transfers";
