/**
 * Closed-form geometric pricing math, mirroring the approach proven in
 * @idlekitjs/mechanics producers: exact series sums, a logarithmic inverse for
 * "max affordable", and a bounded correction loop against floating point
 * over/under-shoot around powers.
 */

/** Sum of `count` terms of a geometric series starting at `first`, ratio `growth`. */
export function geometricSum(first: number, growth: number, count: number): number {
  if (count <= 0) {
    return 0;
  }
  if (growth === 1) {
    return first * count;
  }
  return (first * (Math.pow(growth, count) - 1)) / (growth - 1);
}

/**
 * Largest whole `count` such that `geometricSum(first, growth, count)` fits in
 * `budget`. `growth` must be finite and > 0 (validated by the curve factories).
 * A free series (`first <= 0`) is capped at `Number.MAX_SAFE_INTEGER`.
 */
export function geometricAffordable(first: number, growth: number, budget: number): number {
  if (!Number.isFinite(budget) || budget <= 0) {
    return 0;
  }
  if (first <= 0) {
    return Number.MAX_SAFE_INTEGER;
  }
  if (budget < first) {
    return 0;
  }
  if (growth === 1) {
    return Math.min(Math.floor(budget / first), Number.MAX_SAFE_INTEGER);
  }

  let raw: number;
  if (growth < 1) {
    // Decreasing prices: the series converges to first / (1 - growth); a budget
    // at or past the limit affords unbounded units.
    const limit = first / (1 - growth);
    if (budget >= limit) {
      return Number.MAX_SAFE_INTEGER;
    }
    raw = Math.log(1 - (budget * (1 - growth)) / first) / Math.log(growth);
  } else {
    raw = Math.log((budget * (growth - 1)) / first + 1) / Math.log(growth);
  }

  let count = Math.max(0, Math.floor(raw + 1e-12));
  // Floating point precision around powers can over/under-shoot by one. Keep
  // the correction bounded; the closed-form inverse still does the real work.
  for (let i = 0; i < 8 && count > 0 && geometricSum(first, growth, count) > budget; i++) {
    count--;
  }
  for (let i = 0; i < 8 && geometricSum(first, growth, count + 1) <= budget; i++) {
    count++;
  }
  return Math.min(count, Number.MAX_SAFE_INTEGER);
}
