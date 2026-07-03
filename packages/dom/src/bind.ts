import type { Binding } from "@idlekitjs/types";

/**
 * Declarative DOM bindings.
 *
 * Each binding remembers the last value it rendered and only touches the DOM
 * when it changes. Combined with reactive state, this removes the useless DOM
 * writes of the "redraw everything every tick" model.
 */

/** Bind an element's text to a getter. */
export function bindText(element: HTMLElement, getter: () => unknown): Binding {
  let last: string | undefined;
  return {
    update(): void {
      const next = String(getter());
      if (next !== last) {
        last = next;
        element.textContent = next;
      }
    },
  };
}

/** Bind the presence of a CSS class to a condition. */
export function bindClass(element: HTMLElement, className: string, getter: () => boolean): Binding {
  let last: boolean | undefined;
  return {
    update(): void {
      const next = getter();
      if (next !== last) {
        last = next;
        element.classList.toggle(className, next);
      }
    },
  };
}

/** Bind an element's visibility (via the `hidden` attribute) to a condition. */
export function bindVisible(element: HTMLElement, getter: () => boolean): Binding {
  let last: boolean | undefined;
  return {
    update(): void {
      const next = getter();
      if (next !== last) {
        last = next;
        element.hidden = !next;
      }
    },
  };
}

/** Bind a control's `disabled` state to a condition. */
export function bindDisabled(
  element: HTMLButtonElement | HTMLInputElement,
  getter: () => boolean,
): Binding {
  let last: boolean | undefined;
  return {
    update(): void {
      const next = getter();
      if (next !== last) {
        last = next;
        element.disabled = next;
      }
    },
  };
}
