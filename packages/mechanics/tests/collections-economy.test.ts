import { describe, expect, it } from "vitest";
import { createEconomy, EconomyError, stateKey, type Economy } from "@idlekitjs/economy";
import type { CollectionData } from "../src/collections";
import {
  cardLevelAtLeast,
  cardLevelBelow,
  cardLevelResourceId,
  cardResources,
  cardShardResourceId,
  hasCardShards,
} from "../src/collections/economy";

interface TestState {
  science: number;
  collection: CollectionData;
}

const CARDS = [{ id: "collective-manager" }, { id: "red-star" }];

function createState(): TestState {
  return {
    science: 100,
    collection: {
      collectibles: { "collective-manager": { quantity: 4, level: 2 } },
      rngState: 1,
    },
  };
}

function createTestEconomy(): Economy<TestState> {
  return createEconomy<TestState>()
    .resource({ id: "currency:science", accessor: stateKey("science") })
    .resources(
      cardResources(CARDS, {
        getData: (state) => state.collection,
        setData: (state, data) => {
          state.collection = data;
        },
      }),
    );
}

describe("card resource ids", () => {
  it("derive the card namespace", () => {
    expect(cardShardResourceId("red-star")).toBe("card:red-star:shards");
    expect(cardLevelResourceId("red-star")).toBe("card:red-star:level");
  });
});

describe("cardResources", () => {
  it("exposes shards as a writable integer resource", () => {
    const economy = createTestEconomy();
    const state = createState();
    expect(economy.get(state, "card:collective-manager:shards")).toBe(4);

    economy.add(state, "card:collective-manager:shards", 3);
    expect(state.collection.collectibles["collective-manager"].quantity).toBe(7);
    // The level is untouched by shard writes.
    expect(state.collection.collectibles["collective-manager"].level).toBe(2);
  });

  it("creates the entry on first credit (never-seen card)", () => {
    const economy = createTestEconomy();
    const state = createState();
    expect(economy.get(state, "card:red-star:shards")).toBe(0);

    economy.credit(state, [["card:red-star:shards", 2]]);
    expect(state.collection.collectibles["red-star"]).toEqual({ quantity: 2, level: 0 });
  });

  it("reassigns the collection sub-state (reactivity)", () => {
    const economy = createTestEconomy();
    const state = createState();
    const before = state.collection;
    economy.add(state, "card:red-star:shards", 1);
    expect(state.collection).not.toBe(before);
    expect(state.collection.rngState).toBe(1);
  });

  it("exposes levels as read-only resources", () => {
    const economy = createTestEconomy();
    const state = createState();
    expect(economy.get(state, "card:collective-manager:level")).toBe(2);
    expect(economy.get(state, "card:red-star:level")).toBe(0);
    expect(economy.resource("card:red-star:level").readonly).toBe(true);
    expect(() => economy.add(state, "card:red-star:level", 1)).toThrow(EconomyError);
  });

  it("rejects levels in transaction costs with a readonly diagnostic", () => {
    const economy = createTestEconomy();
    const preview = economy.preview(createState(), {
      id: "tx",
      cost: [["card:collective-manager:level", 1]],
    });
    expect(preview.failures).toEqual([
      {
        kind: "readonly-resource",
        resourceId: "card:collective-manager:level",
        where: "cost",
      },
    ]);
  });
});

describe("card requirements", () => {
  it("cardLevelAtLeast checks the level with progress", () => {
    const economy = createTestEconomy();
    const state = createState();
    expect(cardLevelAtLeast<TestState>("collective-manager", 2).isMet(state, economy)).toBe(true);
    const requirement = cardLevelAtLeast<TestState>("collective-manager", 5);
    expect(requirement.isMet(state, economy)).toBe(false);
    expect(requirement.progress?.(state, economy)).toEqual({ current: 2, target: 5 });
  });

  it("cardLevelBelow gates maxed cards", () => {
    const economy = createTestEconomy();
    const state = createState();
    expect(cardLevelBelow<TestState>("collective-manager", 5).isMet(state, economy)).toBe(true);
    expect(cardLevelBelow<TestState>("collective-manager", 2).isMet(state, economy)).toBe(false);
  });

  it("hasCardShards checks held copies without consuming them", () => {
    const economy = createTestEconomy();
    const state = createState();
    expect(hasCardShards<TestState>("collective-manager", 4).isMet(state, economy)).toBe(true);
    expect(hasCardShards<TestState>("collective-manager", 5).isMet(state, economy)).toBe(false);
    expect(state.collection.collectibles["collective-manager"].quantity).toBe(4);
  });
});

describe("card upgrade as a transaction (shards + currency cost)", () => {
  it("spends shards and science, applies the level through game code", () => {
    const economy = createTestEconomy();
    const state = createState();

    const result = economy.execute(state, {
      id: "upgrade-card:collective-manager",
      requirements: [cardLevelBelow("collective-manager", 5)],
      cost: [
        [cardShardResourceId("collective-manager"), 4],
        ["currency:science", 50],
      ],
      apply: (current) => {
        const entry = current.collection.collectibles["collective-manager"];
        current.collection = {
          ...current.collection,
          collectibles: {
            ...current.collection.collectibles,
            "collective-manager": { ...entry, level: entry.level + 1 },
          },
        };
      },
    });

    expect(result.ok).toBe(true);
    expect(state.science).toBe(50);
    expect(state.collection.collectibles["collective-manager"]).toEqual({
      quantity: 0,
      level: 3,
    });
  });
});
