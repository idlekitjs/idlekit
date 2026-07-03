import { describe, expect, it } from "vitest";
import { createEconomy, costCurve, flat, geometric, stateKey, type Economy } from "@idlekitjs/economy";
import { producers } from "../src/producers";
import type { ProducerColumn, ProducerDef, ProducersExtension } from "../src/producers";
import {
  economyPurchase,
  producerOutput,
  producerPurchase,
  producerResourceId,
  producerResources,
} from "../src/producers/economy";

interface TestState {
  potatoes: number;
  coins: number;
  owned: number[];
  total: number[];
  progress: number[];
}

const DEFS: ProducerDef[] = [
  { id: "comrade", cycleTime: 1, yieldPerUnit: 1, baseCost: 10, costGrowth: 1.15 },
  { id: "collective", cycleTime: 5, yieldPerUnit: 0.5, baseCost: 5, costGrowth: 1.2 },
  { id: "factory", cycleTime: 10, yieldPerUnit: 0.25, baseCost: 3, costGrowth: 1.25 },
];

function createState(): TestState {
  return {
    potatoes: 1000,
    coins: 5000,
    owned: DEFS.map(() => 0),
    total: [1, 0, 0],
    progress: DEFS.map(() => 0),
  };
}

const column = {
  getColumn: (state: TestState): ProducerColumn => ({
    owned: state.owned,
    total: state.total,
    progress: state.progress,
  }),
  setColumn: (state: TestState, patch: Partial<ProducerColumn>): void => {
    if (patch.owned) state.owned = patch.owned;
    if (patch.total) state.total = patch.total;
    if (patch.progress) state.progress = patch.progress;
  },
};

function createTestEconomy(): Economy<TestState> {
  return createEconomy<TestState>()
    .resource({ id: "currency:potatoes", accessor: stateKey("potatoes") })
    .resource({ id: "currency:coins", accessor: stateKey("coins") })
    .resources(producerResources(DEFS, column));
}

function resourceByTier(index: number): string {
  return index === 0 ? "currency:potatoes" : producerResourceId(DEFS[index - 1].id);
}

/** The AdVenture Communist purchase rule, as written in the game today. */
function legacyPurchase(): { getBudget: (s: TestState, i: number) => number; pay: (s: TestState, i: number, a: number) => void } {
  return {
    getBudget: (state, index) =>
      index === 0 ? state.potatoes : Math.floor(state.total[index - 1] ?? 0),
    pay: (state, index, amount) => {
      if (index === 0) {
        state.potatoes -= amount;
        return;
      }
      const total = state.total.slice();
      total[index - 1] -= Math.ceil(amount);
      state.total = total;
    },
  };
}

function createExtension(
  purchase: { getBudget: (s: TestState, i: number) => number; pay: (s: TestState, i: number, a: number) => void },
): ProducersExtension<TestState> {
  return producers<TestState>({
    definitions: DEFS,
    getColumn: column.getColumn,
    setColumn: column.setColumn,
    resource: {
      get: (s) => s.potatoes,
      add: (s, amount) => {
        s.potatoes += amount;
      },
    },
    purchase,
  });
}

describe("producerResourceId", () => {
  it("derives the producer namespace", () => {
    expect(producerResourceId("collective")).toBe("producer:collective");
  });
});

describe("producerResources", () => {
  it("exposes tier totals as resources, writes via setColumn reassign", () => {
    const economy = createTestEconomy();
    const state = createState();
    expect(economy.get(state, "producer:comrade")).toBe(1);

    const before = state.total;
    economy.add(state, "producer:collective", 3);
    expect(state.total).not.toBe(before);
    expect(state.total[1]).toBe(3);
  });

  it("carries the def tags", () => {
    const economy = createTestEconomy();
    expect(economy.resource("producer:comrade").tags).toEqual([]);
  });
});

describe("producerOutput", () => {
  it("bridges an economy resource into the producers resource seam", () => {
    const economy = createTestEconomy();
    const state = createState();
    const output = producerOutput(economy, "currency:potatoes");
    expect(output.get(state)).toBe(1000);
    output.add(state, 50);
    expect(state.potatoes).toBe(1050);
  });
});

describe("economyPurchase", () => {
  it("matches the legacy AC scalar seam over a purchase sequence", () => {
    const legacyState = createState();
    const economyState = createState();
    // Give the tiers something to spend.
    legacyState.total = [30, 12, 0];
    economyState.total = [30, 12, 0];

    const legacyExt = createExtension(legacyPurchase());
    const economy = createTestEconomy();
    const economyExt = createExtension(
      economyPurchase(economy, resourceByTier, { wholeUnits: (index) => index > 0 }),
    );

    // Mixed sequence across tiers, including bulk purchases.
    for (const [index, quantity] of [
      [0, 1],
      [0, 5],
      [1, 2],
      [2, 1],
      [1, 3],
      [0, 100],
    ] as const) {
      const legacyResult = legacyExt.purchaseMany(index, legacyState, quantity);
      const economyResult = economyExt.purchaseMany(index, economyState, quantity);
      expect(economyResult).toEqual(legacyResult);
    }

    expect(economyState).toEqual(legacyState);
  });

  it("floors fractional budgets and ceils payments for whole-unit tiers", () => {
    const economy = createTestEconomy();
    const purchase = economyPurchase(economy, resourceByTier, {
      wholeUnits: (index) => index > 0,
    });
    const state = createState();
    state.total = [10.7, 0, 0];

    expect(purchase.getBudget(state, 1)).toBe(10);
    purchase.pay(state, 1, 4.2);
    expect(state.total[0]).toBeCloseTo(5.7, 10);
  });

  it("keeps fractional budgets for non-whole-unit tiers", () => {
    const economy = createTestEconomy();
    const purchase = economyPurchase(economy, resourceByTier, {
      wholeUnits: (index) => index > 0,
    });
    const state = createState();
    state.potatoes = 25.5;
    expect(purchase.getBudget(state, 0)).toBe(25.5);
    purchase.pay(state, 0, 10.25);
    expect(state.potatoes).toBeCloseTo(15.25, 10);
  });
});

describe("producers grant", () => {
  it("adds to total only by default (pure gift)", () => {
    const ext = createExtension(legacyPurchase());
    const state = createState();
    expect(ext.grant(1, state, 3)).toBe(true);
    expect(state.total[1]).toBe(3);
    expect(state.owned[1]).toBe(0);
  });

  it("advances the cost curve with owned: true", () => {
    const ext = createExtension(legacyPurchase());
    const state = createState();
    const costBefore = ext.cost(1, state);
    ext.grant(1, state, 2, { owned: true });
    expect(state.owned[1]).toBe(2);
    expect(ext.cost(1, state)).toBeGreaterThan(costBefore);
  });

  it("resets progress when activating an empty tier", () => {
    const ext = createExtension(legacyPurchase());
    const state = createState();
    state.progress[2] = 4;
    ext.grant(2, state, 1);
    expect(state.progress[2]).toBe(0);
  });

  it("rejects invalid indices and quantities", () => {
    const ext = createExtension(legacyPurchase());
    const state = createState();
    expect(ext.grant(99, state, 1)).toBe(false);
    expect(ext.grant(0, state, 0)).toBe(false);
    expect(ext.grant(0, state, -2)).toBe(false);
  });
});

describe("producerPurchase (composite cost)", () => {
  it("pays a multi-resource curve and grants owned units", () => {
    const economy = createTestEconomy();
    const state = createState();
    state.total = [0, 5, 0];

    const ext = createExtension(legacyPurchase());
    const curve = costCurve<TestState>({
      getOwned: (s) => s.owned[2] ?? 0,
      lines: [
        flat(producerResourceId("collective"), 1),
        geometric("currency:coins", { baseAmount: 1000, growth: 1.15, round: "ceil" }),
      ],
    });

    const transaction = producerPurchase({ producers: ext, index: 2, curve });
    const result = economy.execute(state, transaction);

    expect(result.ok).toBe(true);
    expect(state.total[1]).toBe(4); // 1 collective consumed
    expect(state.coins).toBe(4000); // ceil(1000 * 1.15^0)
    expect(state.total[2]).toBe(1);
    expect(state.owned[2]).toBe(1); // cost curve advanced
  });

  it("fails with diagnostics when one resource is short, paying nothing", () => {
    const economy = createTestEconomy();
    const state = createState();
    state.total = [0, 0, 0]; // no collectives
    const ext = createExtension(legacyPurchase());
    const curve = costCurve<TestState>({
      getOwned: (s) => s.owned[2] ?? 0,
      lines: [
        flat(producerResourceId("collective"), 1),
        geometric("currency:coins", { baseAmount: 1000, growth: 1.15 }),
      ],
    });

    const result = economy.execute(state, producerPurchase({ producers: ext, index: 2, curve }));
    expect(result.ok).toBe(false);
    expect(state.coins).toBe(5000);
    expect(state.total[2]).toBe(0);
    if (!result.ok) {
      expect(result.missing).toEqual([
        { resourceId: "producer:collective", amount: 1 },
      ]);
    }
  });
});
