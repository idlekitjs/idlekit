import { describe, expect, it, vi } from "vitest";
import {
  createEconomy,
  readonly,
  resourceAtLeast,
  stateKey,
  type Economy,
  type Transaction,
} from "../src";

interface TestState {
  gold: number;
  science: number;
  energy: number;
  rank: number;
  upgrades: string[];
}

function createState(): TestState {
  return { gold: 100, science: 10, energy: 50, rank: 3, upgrades: [] };
}

function createTestEconomy(): Economy<TestState> {
  return createEconomy<TestState>()
    .resource({ id: "currency:gold", accessor: stateKey("gold") })
    .resource({ id: "currency:science", accessor: stateKey("science"), integer: true })
    .resource({ id: "currency:energy", accessor: stateKey("energy"), max: 60 })
    .resource({ id: "stat:rank", accessor: readonly((state) => state.rank) });
}

const buyUpgrade: Transaction<TestState> = {
  id: "buy-upgrade",
  requirements: [resourceAtLeast("currency:science", 5)],
  cost: [["currency:gold", 40]],
  reward: [["currency:energy", 5]],
  apply: (state) => {
    state.upgrades.push("plow");
  },
};

describe("preview", () => {
  it("is pure: never mutates the state, even on success", () => {
    const economy = createTestEconomy();
    const state = createState();
    const before = structuredClone(state);

    const preview = economy.preview(state, buyUpgrade);
    expect(preview.ok).toBe(true);
    expect(state).toEqual(before);
  });

  it("resolves and normalizes cost/reward", () => {
    const economy = createTestEconomy();
    const preview = economy.preview(createState(), {
      id: "tx",
      cost: [
        ["currency:gold", 10],
        { resourceId: "currency:gold", amount: 5 },
        ["currency:science", 0],
      ],
    });
    expect(preview.cost).toEqual([{ resourceId: "currency:gold", amount: 15 }]);
    expect(preview.reward).toEqual([]);
  });

  it("collects every failure, not just the first", () => {
    const economy = createTestEconomy();
    const state = createState();
    state.gold = 5;
    state.science = 0;

    const preview = economy.preview(state, buyUpgrade);
    expect(preview.ok).toBe(false);
    expect(preview.failures.map((failure) => failure.kind).sort()).toEqual([
      "cannot-afford",
      "requirement-failed",
    ]);
    expect(preview.missing).toEqual([{ resourceId: "currency:gold", amount: 35 }]);
  });

  it("diagnoses unknown resources instead of throwing (data path)", () => {
    const economy = createTestEconomy();
    const preview = economy.preview(createState(), {
      id: "tx",
      cost: [["currency:nope", 1]],
      reward: [["currency:missing", 1]],
    });
    expect(preview.failures).toEqual([
      { kind: "unknown-resource", resourceId: "currency:nope", where: "cost" },
      { kind: "unknown-resource", resourceId: "currency:missing", where: "reward" },
    ]);
  });

  it("diagnoses invalid amounts (negative, NaN, fractional on integer)", () => {
    const economy = createTestEconomy();
    const preview = economy.preview(createState(), {
      id: "tx",
      cost: [["currency:gold", -5]],
      reward: [["currency:science", 1.5]],
    });
    expect(preview.failures.map((failure) => failure.kind)).toEqual([
      "invalid-amount",
      "invalid-amount",
    ]);
  });

  it("diagnoses readonly resources in cost and reward", () => {
    const economy = createTestEconomy();
    const preview = economy.preview(createState(), {
      id: "tx",
      cost: [["stat:rank", 1]],
    });
    expect(preview.failures).toEqual([
      { kind: "readonly-resource", resourceId: "stat:rank", where: "cost" },
    ]);
  });

  it("diagnoses NaN balances as invalid-state", () => {
    const economy = createTestEconomy();
    const state = createState();
    state.gold = NaN;
    const preview = economy.preview(state, buyUpgrade);
    expect(preview.failures).toContainEqual({
      kind: "invalid-state",
      resourceId: "currency:gold",
    });
  });

  it("carries requirement label and progress into the failure", () => {
    const economy = createTestEconomy();
    const state = createState();
    state.science = 2;
    const preview = economy.preview(state, buyUpgrade);
    expect(preview.failures).toContainEqual({
      kind: "requirement-failed",
      requirementId: "resource-at-least:currency:science:5",
      label: undefined,
      progress: { current: 2, target: 5 },
    });
  });

  it("reports reward overflow without blocking", () => {
    const economy = createTestEconomy();
    const state = createState();
    state.energy = 58;
    const preview = economy.preview(state, buyUpgrade);
    expect(preview.ok).toBe(true);
    expect(preview.overflow).toEqual([{ resourceId: "currency:energy", amount: 3 }]);
  });
});

describe("execute", () => {
  it("mutates only when the preview is clean, in pay -> apply -> credit order", () => {
    const economy = createTestEconomy();
    const state = createState();
    const journal: string[] = [];

    const result = economy.execute(state, {
      id: "ordered",
      cost: [
        [
          "currency:gold",
          40,
        ],
      ],
      reward: [["currency:science", 2]],
      apply: (current) => {
        journal.push(`apply gold=${current.gold} science=${current.science}`);
      },
    });

    expect(result.ok).toBe(true);
    // Cost already paid, reward not yet credited when apply runs.
    expect(journal).toEqual(["apply gold=60 science=10"]);
    expect(state.gold).toBe(60);
    expect(state.science).toBe(12);
  });

  it("does not pay when a requirement fails", () => {
    const economy = createTestEconomy();
    const state = createState();
    state.science = 0;
    const before = structuredClone(state);

    const result = economy.execute(state, buyUpgrade);
    expect(result.ok).toBe(false);
    expect(state).toEqual(before);
  });

  it("does not apply when the cost is missing", () => {
    const economy = createTestEconomy();
    const state = createState();
    state.gold = 5;
    const apply = vi.fn();

    const result = economy.execute(state, { ...buyUpgrade, apply });
    expect(result.ok).toBe(false);
    expect(apply).not.toHaveBeenCalled();
    expect(state.gold).toBe(5);
    if (!result.ok) {
      expect(result.missing).toEqual([{ resourceId: "currency:gold", amount: 35 }]);
    }
  });

  it("resolves a dynamic cost exactly once per execute", () => {
    const economy = createTestEconomy();
    const state = createState();
    const cost = vi.fn(() => [["currency:gold", 10]] as const);

    const result = economy.execute(state, { id: "dynamic", cost });
    expect(result.ok).toBe(true);
    expect(cost).toHaveBeenCalledTimes(1);
    expect(state.gold).toBe(90);
  });

  it("clamps the credited reward and reports the real overflow", () => {
    const economy = createTestEconomy();
    const state = createState();
    state.energy = 58;

    const result = economy.execute(state, buyUpgrade);
    expect(result.ok).toBe(true);
    expect(state.energy).toBe(60);
    if (result.ok) {
      expect(result.overflow).toEqual([{ resourceId: "currency:energy", amount: 3 }]);
    }
  });

  it("lets an apply throw propagate (documented programming error, no rollback)", () => {
    const economy = createTestEconomy();
    const state = createState();

    expect(() =>
      economy.execute(state, {
        id: "broken",
        cost: [["currency:gold", 10]],
        apply: () => {
          throw new Error("game bug");
        },
      }),
    ).toThrow("game bug");
    // The cost was paid before apply ran: that is the documented contract.
    expect(state.gold).toBe(90);
  });

  it("canExecute mirrors preview().ok", () => {
    const economy = createTestEconomy();
    const state = createState();
    expect(economy.canExecute(state, buyUpgrade)).toBe(true);
    state.gold = 0;
    expect(economy.canExecute(state, buyUpgrade)).toBe(false);
  });
});
