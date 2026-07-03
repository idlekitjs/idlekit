/**
 * Small numeric helpers shared across the engine. They exist to make "use the
 * real value, fall back when it is not usable" explicit and consistent, instead
 * of scattering ad-hoc `?? 0`, `> 0 ? x : d` and manual clamps.
 */

/** Constrain `value` to the inclusive `[min, max]` range. */
export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** `value` when it is a finite number (not NaN/Infinity), otherwise `fallback`. */
export function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

/** `value` when it is a finite number strictly greater than 0, otherwise `fallback`. */
export function positiveOr(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
