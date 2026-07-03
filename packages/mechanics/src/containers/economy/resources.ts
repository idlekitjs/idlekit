import { computed, readonly, type ResourceId, type ResourceInit } from "@idlekitjs/economy";
import type { ContainersExtension } from "../types";

/**
 * Expose a container's content amounts as Economy resources, one per content
 * id. Reads report the stored amount; credits go through `fill` (all-or-
 * nothing, so an over-capacity credit throws as the wiring error it is) and
 * debits through `drain`. The container stays the source of truth — Economy
 * only observes and trades the same numbers.
 */
export function containerContentResources<T extends object>(
  containers: ContainersExtension<T>,
  containerId: string,
  contentIds: readonly string[],
  options: {
    /** Map a content id to a resource id (default: `<containerId>:<contentId>`). */
    resourceId?: (contentId: string) => ResourceId;
    label?: (contentId: string) => string;
  } = {},
): ResourceInit<T>[] {
  const idOf = options.resourceId ?? ((contentId: string): ResourceId => `${containerId}:${contentId}`);
  return contentIds.map((contentId) => ({
    id: idOf(contentId),
    label: options.label?.(contentId),
    accessor: computed<T>({
      get: (state) => containers.contents(state, containerId)[contentId] ?? 0,
      add: (state, amount) => {
        if (amount >= 0) {
          if (!containers.fill(state, containerId, contentId, amount)) {
            throw new Error(
              `containers: cannot credit ${amount} of "${contentId}" into "${containerId}" (over capacity?). Gate with containerHasSpace.`,
            );
          }
          return;
        }
        containers.drain(state, containerId, { contentId, amount: -amount });
      },
    }),
  }));
}

/**
 * Read-only resource exposing a container's free capacity — usable in generic
 * requirements (`resourceAtLeast(freeSpaceId, n)`) and formatting. Capacity
 * itself is never writable through Economy.
 */
export function containerFreeSpaceResource<T extends object>(
  containers: ContainersExtension<T>,
  containerId: string,
  options: { resourceId?: ResourceId; label?: string } = {},
): ResourceInit<T> {
  return {
    id: options.resourceId ?? `${containerId}:free-space`,
    label: options.label,
    accessor: readonly((state) => containers.free(state, containerId)),
  };
}
