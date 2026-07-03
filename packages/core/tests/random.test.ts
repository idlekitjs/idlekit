import { describe, it, expect } from "vitest";
import { Random, createRandom } from "../src/random";

describe("Random", () => {
  it("is deterministic for a given seed", () => {
    const a = new Random(42);
    const b = new Random(42);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = new Random(1);
    const b = new Random(2);
    expect(a.next()).not.toBe(b.next());
  });

  it("returns floats in [0, 1)", () => {
    const rng = new Random(123);
    for (let i = 0; i < 1000; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("resumes the exact sequence from a persisted state", () => {
    const rng = new Random(7);
    rng.next();
    rng.next();
    const saved = rng.state;
    const future = [rng.next(), rng.next(), rng.next()];

    const restored = new Random(saved);
    expect([restored.next(), restored.next(), restored.next()]).toEqual(future);
  });

  it("int stays within [0, maxExclusive)", () => {
    const rng = new Random(99);
    for (let i = 0; i < 1000; i++) {
      const value = rng.int(6);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(6);
      expect(Number.isInteger(value)).toBe(true);
    }
    expect(rng.int(0)).toBe(0);
  });

  it("range is inclusive on both ends", () => {
    const rng = new Random(5);
    for (let i = 0; i < 1000; i++) {
      const value = rng.range(3, 5);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(5);
    }
    expect(rng.range(4, 2)).toBe(4); // inverted bounds -> min
  });

  it("pick selects an element and throws on empty", () => {
    const rng = new Random(11);
    const items = ["a", "b", "c"];
    expect(items).toContain(rng.pick(items));
    expect(() => rng.pick([])).toThrow(/empty/i);
  });

  it("weighted respects the weights distribution", () => {
    const rng = new Random(2024);
    const counts = { rare: 0, common: 0 };
    for (let i = 0; i < 10000; i++) {
      counts[rng.weighted(["common", "rare"] as const, [90, 10])]++;
    }
    // ~90/10 split; generous bounds to stay robust but meaningful.
    expect(counts.common).toBeGreaterThan(counts.rare * 5);
  });

  it("weighted ignores negative weights and validates inputs", () => {
    const rng = new Random(1);
    expect(rng.weighted(["a", "b"], [0, 1])).toBe("b");
    expect(() => rng.weighted(["a"], [1, 2])).toThrow();
    expect(() => rng.weighted(["a", "b"], [0, 0])).toThrow(/positive/i);
  });

  it("createRandom uses an explicit seed when provided", () => {
    expect(createRandom(50).next()).toBe(new Random(50).next());
  });
});
