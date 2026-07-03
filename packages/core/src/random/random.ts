/**
 * Seedable pseudo-random generator (mulberry32).
 *
 * Deterministic and serializable: persist {@link Random.state} and rebuild with
 * the same value to resume the exact same sequence. This makes random outcomes
 * (loot rolls, drops) reproducible across reloads and immune to save-scumming,
 * and keeps tests deterministic.
 */
export class Random {
  private a: number;

  constructor(seed: number) {
    this.a = seed >>> 0;
  }

  /** Internal state snapshot. Persist it to resume the same sequence. */
  get state(): number {
    return this.a >>> 0;
  }

  /** Next float in [0, 1). */
  next(): number {
    this.a = (this.a + 0x6d2b79f5) | 0;
    let t = Math.imul(this.a ^ (this.a >>> 15), 1 | this.a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [0, maxExclusive). Returns 0 when `maxExclusive` <= 0. */
  int(maxExclusive: number): number {
    if (maxExclusive <= 0) {
      return 0;
    }
    return Math.floor(this.next() * maxExclusive);
  }

  /** Integer in [minInclusive, maxInclusive]. */
  range(minInclusive: number, maxInclusive: number): number {
    if (maxInclusive < minInclusive) {
      return minInclusive;
    }
    return minInclusive + this.int(maxInclusive - minInclusive + 1);
  }

  /** Uniformly pick one element. Throws on an empty list. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error("Random.pick: cannot pick from an empty list.");
    }
    return items[this.int(items.length)];
  }

  /**
   * Weighted pick: probability of `items[i]` is proportional to `weights[i]`
   * (negative weights are treated as 0). Throws if the lists differ in length
   * or the total weight is not positive.
   */
  weighted<T>(items: readonly T[], weights: readonly number[]): T {
    if (items.length === 0 || items.length !== weights.length) {
      throw new Error("Random.weighted: items and weights must be non-empty and the same length.");
    }
    let total = 0;
    for (const weight of weights) {
      total += weight > 0 ? weight : 0;
    }
    if (total <= 0) {
      throw new Error("Random.weighted: the total weight must be positive.");
    }
    let threshold = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      threshold -= weights[i] > 0 ? weights[i] : 0;
      if (threshold < 0) {
        return items[i];
      }
    }
    return items[items.length - 1];
  }
}

/** Create a `Random`. Without a seed, one is derived from the current time. */
export function createRandom(seed: number = Date.now() >>> 0): Random {
  return new Random(seed);
}
