import { EconomyError } from "../economy/errors";
import type { AmountsInput, ResourceAmount } from "./types";

/**
 * Normalization split by error channel: `collectAmounts` reports invalid lines
 * (negative, NaN, Infinity) so the transaction pipeline can turn them into
 * diagnostics, while `normalizeAmounts` throws — the right behavior for the
 * direct code path (`pay`, `credit`, helpers).
 */

/** Coerce one input line (tuple or object) into a {@link ResourceAmount}. */
function toLine(entry: AmountsInput[number]): ResourceAmount {
  return Array.isArray(entry)
    ? { resourceId: entry[0], amount: entry[1] }
    : (entry as ResourceAmount);
}

export interface CollectedAmounts {
  /** Valid lines: duplicates merged by sum, zero lines dropped. */
  amounts: ResourceAmount[];
  /** Lines rejected for a negative or non-finite amount, in input order. */
  invalid: ResourceAmount[];
}

/**
 * Lenient normalization: validate each line, merge duplicates of the valid
 * ones (first-seen order), drop zero totals. Never throws.
 */
export function collectAmounts(input: AmountsInput): CollectedAmounts {
  const merged = new Map<string, number>();
  const invalid: ResourceAmount[] = [];

  for (const entry of input) {
    const line = toLine(entry);
    if (!Number.isFinite(line.amount) || line.amount < 0) {
      invalid.push(line);
      continue;
    }
    merged.set(line.resourceId, (merged.get(line.resourceId) ?? 0) + line.amount);
  }

  const amounts: ResourceAmount[] = [];
  for (const [resourceId, amount] of merged) {
    if (amount !== 0) {
      amounts.push({ resourceId, amount });
    }
  }
  return { amounts, invalid };
}

/**
 * Strict normalization for the code path: same merging as
 * {@link collectAmounts}, but an invalid line throws {@link EconomyError}.
 */
export function normalizeAmounts(input: AmountsInput): ResourceAmount[] {
  const { amounts, invalid } = collectAmounts(input);
  if (invalid.length > 0) {
    const detail = invalid.map((line) => `${line.resourceId}=${line.amount}`).join(", ");
    throw new EconomyError(`Invalid amounts (negative or non-finite): ${detail}.`);
  }
  return amounts;
}
