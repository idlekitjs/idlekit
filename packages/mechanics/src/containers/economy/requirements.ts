import type { Requirement } from "@idlekitjs/economy";
import type { ContainersExtension } from "../types";

/**
 * Requirement: `amount` (default 1) of `contentId` fits in the container.
 * The natural gate for collect/deposit transactions — when the container is
 * full, `preview` reports a `requirement-failed` with used/capacity progress
 * instead of mutating anything.
 */
export function containerHasSpace<T extends object>(
  containers: ContainersExtension<T>,
  containerId: string,
  contentId: string,
  amount = 1,
): Requirement<T> {
  return {
    id: `container-has-space:${containerId}:${contentId}:${amount}`,
    isMet: (state) => containers.canFit(state, containerId, contentId, amount),
    progress: (state) => ({
      current: containers.used(state, containerId),
      target: containers.capacity(state, containerId),
    }),
  };
}
