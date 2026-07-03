/**
 * Economy bridge for the containers mechanic: capacity gates as requirements
 * and container contents/free space as resources. The mechanic stays the
 * source of truth for capacity; Economy never owns it.
 *
 *   import { containerHasSpace } from "@idlekitjs/mechanics/containers/economy";
 */
export { containerHasSpace } from "./requirements";
export { containerContentResources, containerFreeSpaceResource } from "./resources";
