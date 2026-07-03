import { describe, expect, it } from "vitest";
import {
  costCurve,
  createEconomy,
  EconomyError,
  flat,
  geometric,
  geometricSum,
  stateKey,
  type Economy,
} from "../src";

interface TestState {
  coins: number;
  science: number;
  owned: number;
}

function createTestEconomy(): Economy<TestState> {
  return createEconomy<TestState>()
    .resource({ id: "currency:coins", accessor: stateKey("coins") })
    .resource({ id: "currency:science", accessor: stateKey("science") });
}

function amountOf(cost: readonly { resourceId: string; amount: number }[], id: string): number {
  return cost.find((line) => line.resourceId === id)?.amount ?? 0;
}

describe("line factories", () => {
  it("validate at wiring time", () => {
    expect(() => flat("currency:coins", -1)).toThrow(EconomyError);
    expect(() => flat("currency:coins", NaN)).toThrow(EconomyError);
    expect(() => geometric("currency:coins", { baseAmount: 10, growth: 0 })).toThrow(
      EconomyError,
    );
    expect(() => geometric("currency:coins", { baseAmount: 10, growth: -2 })).toThrow(
      EconomyError,
    );
    expect(() => geometric("currency:coins", { baseAmount: 10, growth: Infinity })).toThrow(
      EconomyError,
    );
    expect(() => geometric("currency:coins", { baseAmount: -1, growth: 1.1 })).toThrow(
      EconomyError,
    );
  });

  it("rejects rounded decreasing curves", () => {
    expect(() =>
      costCurve<TestState>({
        getOwned: (state) => state.owned,
        lines: [geometric("currency:coins", { baseAmount: 10, growth: 0.9, round: "ceil" })],
      }),
    ).toThrow(EconomyError);
  });
});

describe("costFor", () => {
  it("prices flat lines as amount * quantity", () => {
    const curve = costCurve<TestState>({
      getOwned: (state) => state.owned,
      lines: [flat("currency:coins", 3)],
    });
    const state: TestState = { coins: 0, science: 0, owned: 5 };
    expect(curve.costFor(state, 4)).toEqual([{ resourceId: "currency:coins", amount: 12 }]);
    expect(curve.next(state)).toEqual([{ resourceId: "currency:coins", amount: 3 }]);
  });

  it("prices geometric lines from the owned count (closed form)", () => {
    const curve = costCurve<TestState>({
      getOwned: (state) => state.owned,
      lines: [geometric("currency:coins", { baseAmount: 100, growth: 1.15 })],
    });
    const state: TestState = { coins: 0, science: 0, owned: 3 };
    const first = 100 * Math.pow(1.15, 3);
    expect(amountOf(curve.next(state), "currency:coins")).toBeCloseTo(first, 8);
    expect(amountOf(curve.costFor(state, 5), "currency:coins")).toBeCloseTo(
      geometricSum(first, 1.15, 5),
      8,
    );
  });

  it("handles growth = 1 as linear pricing", () => {
    const curve = costCurve<TestState>({
      getOwned: (state) => state.owned,
      lines: [geometric("currency:coins", { baseAmount: 7, growth: 1 })],
    });
    const state: TestState = { coins: 0, science: 0, owned: 100 };
    expect(curve.costFor(state, 10)).toEqual([{ resourceId: "currency:coins", amount: 70 }]);
  });

  it("returns an empty cost for quantity <= 0 or non-finite", () => {
    const curve = costCurve<TestState>({
      getOwned: (state) => state.owned,
      lines: [flat("currency:coins", 3)],
    });
    const state: TestState = { coins: 0, science: 0, owned: 0 };
    expect(curve.costFor(state, 0)).toEqual([]);
    expect(curve.costFor(state, -5)).toEqual([]);
    expect(curve.costFor(state, NaN)).toEqual([]);
  });

  it("rounds each unit price so unit prices and bulk totals agree", () => {
    const curve = costCurve<TestState>({
      getOwned: (state) => state.owned,
      lines: [geometric("currency:coins", { baseAmount: 10, growth: 1.5, round: "ceil" })],
    });
    const state: TestState = { coins: 0, science: 0, owned: 1 };
    // Unit prices from owned=1: ceil(15)=15, ceil(22.5)=23, ceil(33.75)=34.
    expect(amountOf(curve.next(state), "currency:coins")).toBe(15);
    expect(amountOf(curve.costFor(state, 3), "currency:coins")).toBe(15 + 23 + 34);
  });

  it("merges lines that share a resource and mixes flat + geometric", () => {
    const curve = costCurve<TestState>({
      getOwned: (state) => state.owned,
      lines: [
        flat("currency:coins", 10),
        geometric("currency:coins", { baseAmount: 5, growth: 1 }),
        geometric("currency:science", { baseAmount: 2, growth: 2 }),
      ],
    });
    const state: TestState = { coins: 0, science: 0, owned: 0 };
    const cost = curve.costFor(state, 2);
    expect(amountOf(cost, "currency:coins")).toBe(20 + 10);
    expect(amountOf(cost, "currency:science")).toBe(2 + 4);
  });
});

describe("maxAffordable", () => {
  it("inverts a flat line exactly", () => {
    const curve = costCurve<TestState>({
      getOwned: (state) => state.owned,
      lines: [flat("currency:coins", 3)],
    });
    const economy = createTestEconomy();
    expect(curve.maxAffordable({ coins: 11, science: 0, owned: 0 }, economy)).toBe(3);
    expect(curve.maxAffordable({ coins: 12, science: 0, owned: 0 }, economy)).toBe(4);
    expect(curve.maxAffordable({ coins: 2, science: 0, owned: 0 }, economy)).toBe(0);
  });

  it("inverts a geometric line, exact at series boundaries", () => {
    const curve = costCurve<TestState>({
      getOwned: (state) => state.owned,
      lines: [geometric("currency:coins", { baseAmount: 100, growth: 1.15 })],
    });
    const economy = createTestEconomy();
    const state: TestState = { coins: 0, science: 0, owned: 4 };
    const first = 100 * Math.pow(1.15, 4);

    for (const quantity of [1, 2, 7, 25]) {
      const exact = geometricSum(first, 1.15, quantity);
      state.coins = exact;
      expect(curve.maxAffordable(state, economy)).toBe(quantity);
      state.coins = exact - 1e-6 * exact;
      expect(curve.maxAffordable(state, economy)).toBe(quantity - 1);
    }
  });

  it("takes the minimum across resources", () => {
    const curve = costCurve<TestState>({
      getOwned: (state) => state.owned,
      lines: [flat("currency:coins", 1), flat("currency:science", 10)],
    });
    const economy = createTestEconomy();
    expect(curve.maxAffordable({ coins: 100, science: 25, owned: 0 }, economy)).toBe(2);
    expect(curve.maxAffordable({ coins: 1, science: 1000, owned: 0 }, economy)).toBe(1);
  });

  it("merges duplicated resource lines before inverting", () => {
    const curve = costCurve<TestState>({
      getOwned: (state) => state.owned,
      lines: [flat("currency:coins", 2), geometric("currency:coins", { baseAmount: 3, growth: 1 })],
    });
    const economy = createTestEconomy();
    // Each unit costs 2 + 3 = 5.
    expect(curve.maxAffordable({ coins: 14, science: 0, owned: 0 }, economy)).toBe(2);
    expect(curve.maxAffordable({ coins: 15, science: 0, owned: 0 }, economy)).toBe(3);
  });

  it("inverts rounded geometric lines against the rounded totals", () => {
    const curve = costCurve<TestState>({
      getOwned: (state) => state.owned,
      lines: [geometric("currency:coins", { baseAmount: 10, growth: 1.5, round: "ceil" })],
    });
    const economy = createTestEconomy();
    // Prices from owned=1: 15, 23, 34 -> totals 15, 38, 72.
    const state: TestState = { coins: 0, science: 0, owned: 1 };
    state.coins = 37;
    expect(curve.maxAffordable(state, economy)).toBe(1);
    state.coins = 38;
    expect(curve.maxAffordable(state, economy)).toBe(2);
    state.coins = 72;
    expect(curve.maxAffordable(state, economy)).toBe(3);
  });

  it("handles large values without overflow surprises", () => {
    const curve = costCurve<TestState>({
      getOwned: (state) => state.owned,
      lines: [geometric("currency:coins", { baseAmount: 1e10, growth: 2 })],
    });
    const economy = createTestEconomy();
    const state: TestState = { coins: 1e300, science: 0, owned: 0 };
    const affordable = curve.maxAffordable(state, economy);
    expect(affordable).toBeGreaterThan(900);
    const cost = curve.costFor(state, affordable);
    expect(amountOf(cost, "currency:coins")).toBeLessThanOrEqual(1e300);
  });

  it("returns MAX_SAFE_INTEGER for free curves", () => {
    const curve = costCurve<TestState>({
      getOwned: (state) => state.owned,
      lines: [flat("currency:coins", 0)],
    });
    const economy = createTestEconomy();
    expect(curve.maxAffordable({ coins: 1, science: 0, owned: 0 }, economy)).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });
});
