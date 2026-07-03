import { EconomyError } from "../economy/errors";
import { normalizeAmounts } from "./normalize";
import type { AmountsInput, ResourceAmount } from "./types";

/**
 * Merge several amount lists into one normalized list (duplicates summed,
 * zeros dropped). Throws on invalid lines: this is a code-path helper.
 */
export function mergeAmounts(...inputs: readonly AmountsInput[]): ResourceAmount[] {
  const all: AmountsInput[number][] = [];
  for (const input of inputs) {
    all.push(...input);
  }
  return normalizeAmounts(all);
}

/**
 * Scale every amount by `factor` (finite, >= 0) and renormalize. Scaling by 0
 * yields an empty list — the natural result for "buy zero of it".
 */
export function scaleAmounts(input: AmountsInput, factor: number): ResourceAmount[] {
  if (!Number.isFinite(factor) || factor < 0) {
    throw new EconomyError(`Scale factor must be a finite number >= 0, got ${factor}.`);
  }
  return normalizeAmounts(
    normalizeAmounts(input).map((line) => ({
      resourceId: line.resourceId,
      amount: line.amount * factor,
    })),
  );
}
