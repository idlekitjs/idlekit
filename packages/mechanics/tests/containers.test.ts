import { describe, expect, it, vi } from "vitest";
import { containers } from "../src/containers";
import type { ContainersData, ContainersExtension } from "../src/containers";

interface TestState {
  storage: ContainersData;
  bonusCapacity: number;
}

function createState(): TestState {
  return { storage: { bin: { scrap: 3 } }, bonusCapacity: 0 };
}

function createExtension(): ContainersExtension<TestState> {
  return containers<TestState>({
    definitions: [
      { id: "bin", capacity: 10 },
      // Volume: gems take 2 slots each; capacity grows with the state.
      {
        id: "vault",
        capacity: (state) => 6 + state.bonusCapacity,
        volumeOf: (contentId) => (contentId === "gem" ? 2 : 1),
      },
    ],
    getData: (state) => state.storage,
    setData: (state, data) => {
      state.storage = data;
    },
  });
}

describe("wiring validation", () => {
  it("throws on duplicate container ids", () => {
    expect(() =>
      containers<TestState>({
        definitions: [
          { id: "bin", capacity: 1 },
          { id: "bin", capacity: 2 },
        ],
        getData: (state) => state.storage,
        setData: () => {},
      }),
    ).toThrow(/duplicate container id/);
  });

  it("throws on invalid static capacity", () => {
    for (const capacity of [0, -5, NaN, Infinity]) {
      expect(() =>
        containers<TestState>({
          definitions: [{ id: "bin", capacity }],
          getData: (state) => state.storage,
          setData: () => {},
        }),
      ).toThrow(/capacity/);
    }
  });

  it("throws at call time when a dynamic capacity resolves invalid", () => {
    const plugin = createExtension();
    const state = createState();
    state.bonusCapacity = -100;
    expect(() => plugin.capacity(state, "vault")).toThrow(/invalid capacity/);
  });
});

describe("used / free / capacity / contents", () => {
  it("reports capacity math with default volume 1", () => {
    const plugin = createExtension();
    const state = createState();
    expect(plugin.capacity(state, "bin")).toBe(10);
    expect(plugin.used(state, "bin")).toBe(3);
    expect(plugin.free(state, "bin")).toBe(7);
    expect(plugin.contents(state, "bin")).toEqual({ scrap: 3 });
  });

  it("weights used capacity by volumeOf", () => {
    const plugin = createExtension();
    const state = createState();
    state.storage = { vault: { gem: 2, coin: 1 } };
    expect(plugin.used(state, "vault")).toBe(2 * 2 + 1);
    expect(plugin.free(state, "vault")).toBe(1);
  });

  it("supports dynamic capacity", () => {
    const plugin = createExtension();
    const state = createState();
    expect(plugin.capacity(state, "vault")).toBe(6);
    state.bonusCapacity = 4;
    expect(plugin.capacity(state, "vault")).toBe(10);
  });

  it("treats unknown containers as empty with zero capacity", () => {
    const plugin = createExtension();
    const state = createState();
    expect(plugin.capacity(state, "nope")).toBe(0);
    expect(plugin.used(state, "nope")).toBe(0);
    expect(plugin.free(state, "nope")).toBe(0);
    expect(plugin.contents(state, "nope")).toEqual({});
  });
});

describe("canFit / fill", () => {
  it("canFit answers against free volume", () => {
    const plugin = createExtension();
    const state = createState();
    expect(plugin.canFit(state, "bin", "scrap", 7)).toBe(true);
    expect(plugin.canFit(state, "bin", "scrap", 8)).toBe(false);
    expect(plugin.canFit(state, "bin", "scrap")).toBe(true); // default amount 1
  });

  it("fill is all-or-nothing and reassigns through setData", () => {
    const setData = vi.fn((state: TestState, data: ContainersData) => {
      state.storage = data;
    });
    const plugin = containers<TestState>({
      definitions: [{ id: "bin", capacity: 10 }],
      getData: (state) => state.storage,
      setData,
    });
    const state = createState();
    const before = state.storage;

    expect(plugin.fill(state, "bin", "scrap", 5)).toBe(true);
    expect(setData).toHaveBeenCalledTimes(1);
    expect(state.storage).not.toBe(before);
    expect(state.storage.bin.scrap).toBe(8);
  });

  it("fill failure mutates nothing", () => {
    const plugin = createExtension();
    const state = createState();
    const before = state.storage;
    expect(plugin.fill(state, "bin", "scrap", 8)).toBe(false);
    expect(state.storage).toBe(before);
  });

  it("fill rejects misuse safely (unknown container, bad amounts)", () => {
    const plugin = createExtension();
    const state = createState();
    expect(plugin.fill(state, "nope", "scrap", 1)).toBe(false);
    expect(plugin.fill(state, "bin", "scrap", 0)).toBe(false);
    expect(plugin.fill(state, "bin", "scrap", -2)).toBe(false);
    expect(plugin.fill(state, "bin", "scrap", NaN)).toBe(false);
    expect(state.storage).toEqual({ bin: { scrap: 3 } });
  });

  it("fillUpTo accepts what fits and returns the accepted amount", () => {
    const plugin = createExtension();
    const state = createState();
    expect(plugin.fillUpTo(state, "bin", "scrap", 20)).toBe(7);
    expect(state.storage.bin.scrap).toBe(10);
    expect(plugin.fillUpTo(state, "bin", "scrap", 5)).toBe(0);
    expect(plugin.fillUpTo(state, "nope", "scrap", 5)).toBe(0);
  });

  it("accounts for content volume when filling", () => {
    const plugin = createExtension();
    const state = createState();
    state.storage = { vault: {} };
    expect(plugin.fill(state, "vault", "gem", 4)).toBe(false); // 8 > 6
    expect(plugin.fillUpTo(state, "vault", "gem", 4)).toBe(3); // 6 / volume 2
  });
});

describe("drain", () => {
  function filledState(): TestState {
    const state = createState();
    state.storage = { bin: { scrap: 4, glass: 2 } };
    return state;
  }

  it("drains everything by default", () => {
    const plugin = createExtension();
    const state = filledState();
    const result = plugin.drain(state, "bin");
    expect(result.removed).toEqual({ scrap: 4, glass: 2 });
    expect(result.remaining).toEqual({});
    expect(state.storage.bin).toEqual({});
  });

  it("drains a single content type", () => {
    const plugin = createExtension();
    const state = filledState();
    const result = plugin.drain(state, "bin", { contentId: "scrap" });
    expect(result.removed).toEqual({ scrap: 4 });
    expect(result.remaining).toEqual({ glass: 2 });
    expect(state.storage.bin).toEqual({ glass: 2 });
  });

  it("drains partially, capped by what is available", () => {
    const plugin = createExtension();
    const state = filledState();
    expect(plugin.drain(state, "bin", { contentId: "scrap", amount: 3 }).removed).toEqual({
      scrap: 3,
    });
    expect(state.storage.bin.scrap).toBe(1);
    expect(plugin.drain(state, "bin", { contentId: "scrap", amount: 99 }).removed).toEqual({
      scrap: 1,
    });
    // Zero entries are dropped after the drain.
    expect(state.storage.bin).toEqual({ glass: 2 });
  });

  it("returns empty results for unknown containers or absent content", () => {
    const plugin = createExtension();
    const state = filledState();
    expect(plugin.drain(state, "nope")).toEqual({ removed: {}, remaining: {} });
    expect(plugin.drain(state, "bin", { contentId: "gold" }).removed).toEqual({});
    expect(state.storage.bin).toEqual({ scrap: 4, glass: 2 });
  });
});
