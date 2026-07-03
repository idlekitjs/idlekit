import { describe, expect, it } from "vitest";
import { createEconomy, EconomyError, readonly, stateKey, type Economy } from "../src";

interface TestState {
  gold: number;
  science: number;
  energy: number;
  rank: number;
}

function createState(): TestState {
  return { gold: 100, science: 10, energy: 50, rank: 3 };
}

function createTestEconomy(): Economy<TestState> {
  return createEconomy<TestState>()
    .resource({ id: "currency:gold", label: "Gold", accessor: stateKey("gold") })
    .resource({ id: "currency:science", accessor: stateKey("science"), integer: true })
    .resource({ id: "currency:energy", accessor: stateKey("energy"), min: 10, max: 60 })
    .resource({ id: "stat:rank", accessor: readonly((state) => state.rank) });
}

describe("createEconomy registry", () => {
  it("registers chainably and lists ids in order", () => {
    const economy = createTestEconomy();
    expect(economy.ids()).toEqual([
      "currency:gold",
      "currency:science",
      "currency:energy",
      "stat:rank",
    ]);
    expect(economy.has("currency:gold")).toBe(true);
    expect(economy.has("currency:nope")).toBe(false);
  });

  it("throws on duplicate registration", () => {
    const economy = createTestEconomy();
    expect(() =>
      economy.resource({ id: "currency:gold", accessor: stateKey("gold") }),
    ).toThrow(EconomyError);
  });

  it("resource(id) returns the definition and throws on unknown ids", () => {
    const economy = createTestEconomy();
    expect(economy.resource("currency:gold").label).toBe("Gold");
    expect(() => economy.resource("currency:nope")).toThrow(EconomyError);
  });
});

describe("get/add/spend", () => {
  it("reads and writes through the accessors", () => {
    const economy = createTestEconomy();
    const state = createState();
    expect(economy.get(state, "currency:gold")).toBe(100);
    expect(economy.add(state, "currency:gold", 25)).toBe(25);
    expect(state.gold).toBe(125);
  });

  it("throws on unknown resources (code path)", () => {
    const economy = createTestEconomy();
    const state = createState();
    expect(() => economy.get(state, "currency:nope")).toThrow(EconomyError);
    expect(() => economy.add(state, "currency:nope", 1)).toThrow(EconomyError);
  });

  it("clamps adds into [min, max] and returns the applied delta", () => {
    const economy = createTestEconomy();
    const state = createState();
    // energy: 50, max 60 -> only 10 of the 25 land.
    expect(economy.add(state, "currency:energy", 25)).toBe(10);
    expect(state.energy).toBe(60);
    // energy: 60, min 10 -> only -50 of the -80 land.
    expect(economy.add(state, "currency:energy", -80)).toBe(-50);
    expect(state.energy).toBe(10);
  });

  it("validates integer amounts without rounding them", () => {
    const economy = createTestEconomy();
    const state = createState();
    expect(() => economy.add(state, "currency:science", 1.5)).toThrow(EconomyError);
    expect(state.science).toBe(10);
    economy.add(state, "currency:science", 2);
    expect(state.science).toBe(12);
  });

  it("rejects non-finite amounts and readonly resources", () => {
    const economy = createTestEconomy();
    const state = createState();
    expect(() => economy.add(state, "currency:gold", NaN)).toThrow(EconomyError);
    expect(() => economy.add(state, "stat:rank", 1)).toThrow(EconomyError);
  });

  it("spend is atomic: false without mutation when short", () => {
    const economy = createTestEconomy();
    const state = createState();
    expect(economy.spend(state, "currency:gold", 40)).toBe(true);
    expect(state.gold).toBe(60);
    expect(economy.spend(state, "currency:gold", 61)).toBe(false);
    expect(state.gold).toBe(60);
  });

  it("spend respects the resource floor (spendable = balance - min)", () => {
    const economy = createTestEconomy();
    const state = createState();
    // energy: 50, min 10 -> only 40 is spendable.
    expect(economy.spend(state, "currency:energy", 41)).toBe(false);
    expect(economy.spend(state, "currency:energy", 40)).toBe(true);
    expect(state.energy).toBe(10);
  });
});

describe("bulk cost/reward operations", () => {
  it("canAfford/missing report per-resource shortfalls", () => {
    const economy = createTestEconomy();
    const state = createState();
    const cost = [
      ["currency:gold", 150],
      ["currency:science", 4],
    ] as const;

    expect(economy.canAfford(state, cost)).toBe(false);
    expect(economy.missing(state, cost)).toEqual([
      { resourceId: "currency:gold", amount: 50 },
    ]);
    expect(economy.canAfford(state, [["currency:gold", 100]])).toBe(true);
  });

  it("pay debits every line, and throws without mutating when unaffordable", () => {
    const economy = createTestEconomy();
    const state = createState();
    economy.pay(state, [
      ["currency:gold", 30],
      ["currency:science", 4],
    ]);
    expect(state.gold).toBe(70);
    expect(state.science).toBe(6);

    expect(() =>
      economy.pay(state, [
        ["currency:science", 2],
        ["currency:gold", 1000],
      ]),
    ).toThrow(EconomyError);
    expect(state.science).toBe(6);
    expect(state.gold).toBe(70);
  });

  it("credit clamps at max and returns the overflow", () => {
    const economy = createTestEconomy();
    const state = createState();
    const overflow = economy.credit(state, [
      ["currency:energy", 25],
      ["currency:gold", 10],
    ]);
    expect(state.energy).toBe(60);
    expect(state.gold).toBe(110);
    expect(overflow).toEqual([{ resourceId: "currency:energy", amount: 15 }]);
  });
});

describe("audit", () => {
  it("returns [] for a healthy state", () => {
    expect(createTestEconomy().audit(createState())).toEqual([]);
  });

  it("detects NaN, out-of-bounds and fractional-integer balances", () => {
    const economy = createTestEconomy();
    const state = createState();
    state.gold = NaN;
    state.science = 1.5;
    state.energy = 500;
    const failures = economy.audit(state);
    expect(failures.every((failure) => failure.kind === "invalid-state")).toBe(true);
    expect(
      failures
        .map((failure) => (failure.kind === "invalid-state" ? failure.resourceId : ""))
        .sort(),
    ).toEqual([
      "currency:energy",
      "currency:gold",
      "currency:science",
    ]);
  });
});

describe("multiple economies over one state", () => {
  it("stays coherent (definitions are pure)", () => {
    const a = createEconomy<TestState>().resource({
      id: "currency:gold",
      accessor: stateKey("gold"),
    });
    const b = createEconomy<TestState>().resource({
      id: "currency:gold",
      accessor: stateKey("gold"),
    });
    const state = createState();
    a.add(state, "currency:gold", 10);
    expect(b.get(state, "currency:gold")).toBe(110);
  });
});
