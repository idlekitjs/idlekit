import { positiveOr } from "@idlekitjs/utils";

/**
 * Screen / pixel helpers. A CSS pixel is not a physical pixel: on a high-density
 * display (`devicePixelRatio` 2, 3...) one CSS px spans several device px. Use
 * these to reason in real pixels -- e.g. to decide whether a sub-pixel change is
 * actually visible on the current screen.
 *
 * All helpers are safe outside the browser (no `window`), falling back to a
 * ratio of 1.
 */

/** Physical device pixels per CSS pixel (>= 1; 1 when unknown / non-browser). */
export function devicePixelRatio(): number {
  if (typeof window === "undefined") {
    return 1;
  }
  return positiveOr(window.devicePixelRatio, 1);
}

/** Convert CSS pixels to physical device pixels on the current screen. */
export function cssToDevicePx(cssPx: number): number {
  return cssPx * devicePixelRatio();
}

/** Convert physical device pixels to CSS pixels on the current screen. */
export function deviceToCssPx(devicePx: number): number {
  return devicePx / devicePixelRatio();
}
