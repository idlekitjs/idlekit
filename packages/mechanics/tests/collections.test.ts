import { describe, it, expect, vi } from "vitest";
import {
  collection,
  ModifierRegistry,
  type CollectibleDef,
  type CollectionData,
  type CollectionExtension,
  type CurrencyAccessor,
  type OpenPackReward,
  type PackDef,
  type RarityDef,
} from "../src";

interface TestState {
  science: number;
  collection: CollectionData;
  unlocked: { miner: boolean; special: boolean };
}

const RARITIES: RarityDef[] = [
  { id: "common", weight: 100 },
  { id: "rare", weight: 1, defaults: { duplicates: () => 4, maxLevel: 5 } },
];

const COLLECTIBLES: CollectibleDef<TestState>[] = [
  {
    id: "miner-boost",
    rarity: "common",
    effects: [
      {
        target: { kind: "id", id: "miner" },
        stat: "yield",
        op: "mult",
        value: (lvl) => 1 + 0.5 * lvl,
      },
    ],
    upgrade: {
      duplicates: (lvl) => 2 + lvl,
      costs: [{ currency: "science", amount: (lvl) => 10 * (lvl + 1) }],
      maxLevel: 3,
    },
    eligibility: {
      droppable: (s) => s.unlocked.miner,
      active: (s) => s.unlocked.miner,
      upgradeable: (s) => s.unlocked.miner,
    },
    metadata: { name: "Miner Boost" },
  },
  {
    // Rare and gated: never drops nor is visible until `special` is unlocked.
    id: "locked-card",
    rarity: "rare",
    effects: [{ target: { kind: "all" }, stat: "yield", op: "add", value: (lvl) => lvl }],
    eligibility: {
      visible: (s) => s.unlocked.special,
      droppable: (s) => s.unlocked.special,
    },
  },
];

const PACKS: PackDef<TestState>[] = [
  { id: "starter", draws: 3 },
  { id: "locked-pack", draws: 1, eligibility: { openable: (s) => s.unlocked.special } },
  {
    id: "rich-pack",
    rewards: [
      { kind: "currency", currency: "science", amount: 25 },
      { kind: "cards", rarity: "common", count: 2 },
      { kind: "cards", rarity: "rare", count: { choices: [{ value: 1, weight: 1 }] } },
    ],
  },
  {
    id: "range-pack",
    rewards: [{ kind: "currency", currency: "science", amount: { min: 10, max: 12 } }],
  },
];

const science: CurrencyAccessor<TestState> = {
  id: "science",
  get: (s) => s.science,
  spend: (s, amount) => {
    s.science -= amount;
  },
  add: (s, amount) => {
    s.science += amount;
  },
};

function createState(overrides: Partial<TestState> = {}): TestState {
  return {
    science: 100,
    collection: { collectibles: {}, rngState: 12345 },
    unlocked: { miner: true, special: false },
    ...overrides,
  };
}

function setup(state: TestState = createState()) {
  const registry = new ModifierRegistry();
  const onChange = vi.fn();
  const plugin: CollectionExtension<TestState> = collection<TestState>({
    rarities: RARITIES,
    collectibles: COLLECTIBLES,
    packs: PACKS,
    currencies: [science],
    registry,
    getData: (s) => s.collection,
    setData: (s, data) => {
      s.collection = data;
    },
    onChange,
  });
  return { plugin, registry, state, onChange };
}

function cardRewards(rewards: OpenPackReward[]): Extract<OpenPackReward, { kind: "card" }>[] {
  return rewards.filter(
    (reward): reward is Extract<OpenPackReward, { kind: "card" }> => reward.kind === "card",
  );
}

function currencyRewards(
  rewards: OpenPackReward[],
): Extract<OpenPackReward, { kind: "currency" }>[] {
  return rewards.filter(
    (reward): reward is Extract<OpenPackReward, { kind: "currency" }> => reward.kind === "currency",
  );
}

describe("collection: openPack", () => {
  it("credits copies, only drops eligible rarities, and advances the PRNG", () => {
    const { plugin, state, onChange } = setup();

    const result = plugin.openPack("starter", state);
    const cards = cardRewards(result.rewards);

    expect(result.packId).toBe("starter");
    expect(cards).toHaveLength(1);
    // Only the common is droppable (rare `locked-card` is gated), so all draws hit it.
    expect(cards.every((r) => r.collectibleId === "miner-boost")).toBe(true);
    expect(cards[0].quantity).toBe(3);
    expect(state.collection.collectibles["miner-boost"].quantity).toBe(3);
    expect(cards[0].wasNew).toBe(true);
    expect(state.collection.rngState).not.toBe(12345);
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("supports declarative currency and multi-card rewards", () => {
    const { plugin, state, onChange } = setup(
      createState({ science: 0, unlocked: { miner: true, special: true } }),
    );

    const result = plugin.openPack("rich-pack", state);
    const currencies = currencyRewards(result.rewards);
    const cards = cardRewards(result.rewards);

    expect(currencies).toEqual([
      { kind: "currency", currencyId: "science", amount: 25, previousAmount: 0, newAmount: 25 },
    ]);
    expect(cards).toEqual([
      {
        kind: "card",
        collectibleId: "miner-boost",
        rarity: "common",
        quantity: 2,
        previousQuantity: 0,
        newQuantity: 2,
        wasNew: true,
        canUpgradeAfter: true,
      },
      {
        kind: "card",
        collectibleId: "locked-card",
        rarity: "rare",
        quantity: 1,
        previousQuantity: 0,
        newQuantity: 1,
        wasNew: true,
        canUpgradeAfter: false,
      },
    ]);
    expect(state.science).toBe(25);
    expect(state.collection.collectibles["miner-boost"].quantity).toBe(2);
    expect(state.collection.collectibles["locked-card"].quantity).toBe(1);
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("supports min/max currency rewards", () => {
    const { plugin, state } = setup(createState({ science: 0 }));

    const result = plugin.openPack("range-pack", state);
    const [reward] = currencyRewards(result.rewards);

    expect(reward.currencyId).toBe("science");
    expect(reward.amount).toBeGreaterThanOrEqual(10);
    expect(reward.amount).toBeLessThanOrEqual(12);
    expect(state.science).toBe(reward.amount);
  });

  it("does not drop a card that is already max level", () => {
    const state = createState();
    state.collection.collectibles["miner-boost"] = { quantity: 0, level: 3 };
    const { plugin } = setup(state);

    const result = plugin.openPack("starter", state);

    expect(cardRewards(result.rewards)).toHaveLength(0);
    expect(state.collection.collectibles["miner-boost"]).toEqual({ quantity: 0, level: 3 });
  });

  it("does not drop a card with enough copies to reach max level", () => {
    const state = createState();
    // Miner Boost needs 2 + 3 + 4 copies to go from level 0 to max level 3.
    state.collection.collectibles["miner-boost"] = { quantity: 9, level: 0 };
    const { plugin } = setup(state);

    const result = plugin.openPack("starter", state);

    expect(cardRewards(result.rewards)).toHaveLength(0);
    expect(state.collection.collectibles["miner-boost"]).toEqual({ quantity: 9, level: 0 });
  });

  it("caps card rewards when a pack would overfill the copies needed for max level", () => {
    const state = createState();
    state.collection.collectibles["miner-boost"] = { quantity: 8, level: 0 };
    const { plugin } = setup(state);

    const result = plugin.openPack("starter", state);
    const cards = cardRewards(result.rewards);

    expect(cards).toEqual([
      {
        kind: "card",
        collectibleId: "miner-boost",
        rarity: "common",
        quantity: 1,
        previousQuantity: 8,
        newQuantity: 9,
        wasNew: false,
        canUpgradeAfter: true,
      },
    ]);
    expect(state.collection.collectibles["miner-boost"]).toEqual({ quantity: 9, level: 0 });
  });

  it("is deterministic for a given seed", () => {
    const a = setup();
    const b = setup();
    a.plugin.openPack("starter", a.state);
    b.plugin.openPack("starter", b.state);
    expect(a.state.collection).toEqual(b.state.collection);
  });

  it("returns no reward when the pack is not openable", () => {
    const { plugin, state, onChange } = setup();
    const result = plugin.openPack("locked-pack", state); // requires unlocked.special
    expect(result.rewards).toHaveLength(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("throws on an unknown pack", () => {
    const { plugin, state } = setup();
    expect(() => plugin.openPack("ghost", state)).toThrow(/unknown pack/);
  });
});

describe("collection: canUpgrade", () => {
  it("reports not-owned for an undropped collectible", () => {
    const { plugin, state } = setup();
    const check = plugin.canUpgrade("miner-boost", state);
    expect(check.ok).toBe(false);
    expect(check.ok === false && check.reason).toBe("not-owned");
  });

  it("reports not-enough-duplicates", () => {
    const state = createState();
    state.collection.collectibles["miner-boost"] = { quantity: 1, level: 0 };
    const { plugin } = setup(state);
    const check = plugin.canUpgrade("miner-boost", state);
    expect(check.ok === false && check.reason).toBe("not-enough-duplicates");
    expect(check.requirements.duplicatesRequired).toBe(2);
  });

  it("reports not-enough-currency", () => {
    const state = createState({ science: 0 });
    state.collection.collectibles["miner-boost"] = { quantity: 5, level: 0 };
    const { plugin } = setup(state);
    const check = plugin.canUpgrade("miner-boost", state);
    expect(check.ok === false && check.reason).toBe("not-enough-currency");
    expect(check.requirements.costs[0]).toMatchObject({
      currency: "science",
      required: 10,
      available: 0,
    });
  });

  it("reports max-level", () => {
    const state = createState();
    state.collection.collectibles["miner-boost"] = { quantity: 10, level: 3 };
    const { plugin } = setup(state);
    const check = plugin.canUpgrade("miner-boost", state);
    expect(check.ok === false && check.reason).toBe("max-level");
  });

  it("reports not-eligible when the gate is closed", () => {
    const state = createState({ unlocked: { miner: false, special: false } });
    state.collection.collectibles["miner-boost"] = { quantity: 10, level: 0 };
    const { plugin } = setup(state);
    const check = plugin.canUpgrade("miner-boost", state);
    expect(check.ok === false && check.reason).toBe("not-eligible");
  });

  it("is ok with enough duplicates and currency", () => {
    const state = createState();
    state.collection.collectibles["miner-boost"] = { quantity: 2, level: 0 };
    const { plugin } = setup(state);
    expect(plugin.canUpgrade("miner-boost", state).ok).toBe(true);
  });
});

describe("collection: upgrade", () => {
  it("consumes duplicates and currency, levels up, and publishes the effect", () => {
    const state = createState();
    state.collection.collectibles["miner-boost"] = { quantity: 3, level: 0 };
    const { plugin, registry, onChange } = setup(state);

    expect(registry.resolve({ stat: "yield", id: "miner" })).toBe(1);

    const ok = plugin.upgrade("miner-boost", state);

    expect(ok).toBe(true);
    expect(state.collection.collectibles["miner-boost"]).toEqual({ quantity: 1, level: 1 });
    expect(state.science).toBe(90); // 100 - 10
    expect(registry.resolve({ stat: "yield", id: "miner" })).toBe(1.5); // value(1)
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("does nothing and returns false when the upgrade is blocked", () => {
    const state = createState();
    state.collection.collectibles["miner-boost"] = { quantity: 1, level: 0 };
    const { plugin, onChange } = setup(state);

    expect(plugin.upgrade("miner-boost", state)).toBe(false);
    expect(state.collection.collectibles["miner-boost"]).toEqual({ quantity: 1, level: 0 });
    expect(state.science).toBe(100);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("collection: rebuildModifiers", () => {
  it("republishes effects from owned levels (e.g. after load)", () => {
    const state = createState();
    state.collection.collectibles["miner-boost"] = { quantity: 0, level: 2 };
    const { plugin, registry } = setup(state);

    plugin.rebuildModifiers(state);
    expect(registry.resolve({ stat: "yield", id: "miner" })).toBe(2); // value(2)
  });

  it("drops effects of inactive collectibles", () => {
    const state = createState({ unlocked: { miner: false, special: false } });
    state.collection.collectibles["miner-boost"] = { quantity: 0, level: 2 };
    const { plugin, registry } = setup(state);

    plugin.rebuildModifiers(state);
    expect(registry.resolve({ stat: "yield", id: "miner" })).toBe(1);
  });
});

describe("collection: views", () => {
  it("exposes a single collectible view", () => {
    const state = createState();
    state.collection.collectibles["miner-boost"] = { quantity: 4, level: 1 };
    const { plugin } = setup(state);

    expect(plugin.getCollectible("miner-boost", state)).toMatchObject({
      id: "miner-boost",
      rarity: "common",
      level: 1,
      quantity: 4,
      metadata: { name: "Miner Boost" },
    });
    expect(plugin.getCollectible("ghost", state)).toBeUndefined();
  });

  it("lists only visible collectibles", () => {
    const visible = setup().plugin.getVisible(createState());
    expect(visible.map((v) => v.id)).toEqual(["miner-boost"]); // locked-card hidden

    const unlocked = createState({ unlocked: { miner: true, special: true } });
    expect(
      setup(unlocked)
        .plugin.getVisible(unlocked)
        .map((v) => v.id),
    ).toEqual(["miner-boost", "locked-card"]);
  });
});
