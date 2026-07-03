import type { Binding } from "@idlekitjs/types";
import type { BindEachOptions } from "./types";

interface Tracked<VM> {
  element: HTMLElement;
  item: VM;
}

/**
 * Keyed children reconciler: one element per item, matched by key across
 * renders. New keys get `create`, surviving keys get `update` (never
 * recreated, so listeners and CSS transitions hold), vanished keys get
 * `remove` — which may return a promise to keep the element in the DOM for an
 * exit animation.
 *
 * Purely a rendering helper: it consumes whatever view models the game maps
 * from its state (e.g. a mechanic's `visible(state)`), and gameplay reactions
 * stay in the callbacks the game attaches inside `create`.
 *
 * Ordering follows the iteration order of `items()`; elements are moved with
 * `insertBefore` only when out of place. Register the binding on a `Renderer`
 * — with `add` when the source marks state keys dirty, or `addFrame` for
 * continuously mutated sources such as countdown-driven view models.
 */
export function bindEach<VM>(container: HTMLElement, options: BindEachOptions<VM>): Binding {
  const tracked = new Map<string, Tracked<VM>>();

  return {
    update(): void {
      const seen = new Set<string>();
      let cursor: HTMLElement | null = null;

      for (const item of options.items()) {
        const key = options.key(item);
        seen.add(key);
        let entry = tracked.get(key);
        if (!entry) {
          entry = { element: options.create(item), item };
          tracked.set(key, entry);
        } else {
          entry.item = item;
        }

        // Keep DOM order aligned with item order, touching only misplaced nodes.
        const expectedPrevious: ChildNode | null = cursor;
        if (entry.element.parentNode !== container) {
          container.insertBefore(
            entry.element,
            expectedPrevious ? expectedPrevious.nextSibling : container.firstChild,
          );
        } else if (
          (expectedPrevious === null && entry.element !== container.firstChild) ||
          (expectedPrevious !== null && entry.element.previousSibling !== expectedPrevious)
        ) {
          container.insertBefore(
            entry.element,
            expectedPrevious ? expectedPrevious.nextSibling : container.firstChild,
          );
        }
        cursor = entry.element;

        options.update?.(entry.element, item);
      }

      for (const [key, entry] of tracked) {
        if (seen.has(key)) {
          continue;
        }
        // Untrack immediately: a re-appearing key gets a fresh element even
        // while an exit animation is still playing.
        tracked.delete(key);
        const result = options.remove?.(entry.element, entry.item);
        if (result && typeof result.then === "function") {
          void result.then(() => entry.element.remove());
        } else {
          entry.element.remove();
        }
      }
    },
  };
}
