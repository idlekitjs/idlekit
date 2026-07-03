import { describe, expect, it } from "vitest";
import {
  createEconomy,
  describeFailure,
  stateKey,
  type Economy,
  type TransactionFailure,
} from "../src";

interface TestState {
  gold: number;
  science: number;
}

function createTestEconomy(): Economy<TestState> {
  return createEconomy<TestState>({ format: (amount) => `#${amount}` })
    .resource({ id: "currency:gold", label: "Gold", accessor: stateKey("gold") })
    .resource({
      id: "currency:science",
      label: "Science",
      accessor: stateKey("science"),
      format: (amount) => `${amount} flasks`,
    });
}

describe("formatAmount", () => {
  it("uses the economy-wide formatter by default", () => {
    expect(createTestEconomy().formatAmount("currency:gold", 12)).toBe("#12");
  });

  it("prefers the resource formatter when present", () => {
    expect(createTestEconomy().formatAmount("currency:science", 3)).toBe("3 flasks");
  });
});

describe("formatCost", () => {
  it("returns view models with label, raw amount and affordability", () => {
    const economy = createTestEconomy();
    const state: TestState = { gold: 50, science: 2 };
    const lines = economy.formatCost(state, [
      ["currency:gold", 30],
      ["currency:science", 5],
    ]);

    expect(lines).toEqual([
      {
        resourceId: "currency:gold",
        label: "Gold",
        amount: "#30",
        rawAmount: 30,
        available: 50,
        affordable: true,
      },
      {
        resourceId: "currency:science",
        label: "Science",
        amount: "5 flasks",
        rawAmount: 5,
        available: 2,
        affordable: false,
      },
    ]);
  });
});

describe("formatReward", () => {
  it("returns plain formatted amounts", () => {
    const economy = createTestEconomy();
    expect(economy.formatReward([["currency:gold", 7]])).toEqual([
      { resourceId: "currency:gold", label: "Gold", amount: "#7", rawAmount: 7 },
    ]);
  });
});

describe("describeFailure", () => {
  const failures: TransactionFailure[] = [
    { kind: "unknown-resource", resourceId: "currency:nope", where: "cost" },
    { kind: "invalid-amount", resourceId: "currency:gold", amount: -5, where: "reward" },
    { kind: "invalid-state", resourceId: "currency:gold" },
    {
      kind: "requirement-failed",
      requirementId: "req",
      label: "Level 5",
      progress: { current: 3, target: 5 },
    },
    { kind: "cannot-afford", resourceId: "currency:gold", required: 100, available: 40 },
    { kind: "readonly-resource", resourceId: "stat:rank", where: "cost" },
  ];

  it("covers every failure kind with a sentence", () => {
    for (const failure of failures) {
      const text = describeFailure(failure);
      expect(typeof text).toBe("string");
      expect(text.length).toBeGreaterThan(0);
    }
  });

  it("uses the label resolver when provided", () => {
    expect(
      describeFailure(
        { kind: "cannot-afford", resourceId: "currency:gold", required: 100, available: 40 },
        { label: () => "Gold" },
      ),
    ).toBe("Not enough Gold: requires 100, available 40.");
  });

  it("includes requirement progress when present", () => {
    expect(
      describeFailure({
        kind: "requirement-failed",
        requirementId: "req",
        label: "Level 5",
        progress: { current: 3, target: 5 },
      }),
    ).toBe("Requirement not met: Level 5 (3/5).");
  });
});
