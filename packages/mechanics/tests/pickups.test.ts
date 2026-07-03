import { describe, expect, it, vi } from "vitest";
import { createPickupsData, pickups } from "../src/pickups";
import type { PickupDef, PickupsData, PickupsExtension, PickupsOptions } from "../src/pickups";

interface TestState {
  pickups: PickupsData;
  population: number;
}

function createState(): TestState {
  return { pickups: createPickupsData(42), population: 5 };
}

const DEFS: PickupDef<TestState>[] = [
  {
    id: "scrap",
    lifetime: 20,
    spawn: { every: 4, max: 3, when: (state) => state.population > 0 },
    position: (_state, random) => ({ x: random(), y: random() }),
    metadata: { image: "scrap.gif" },
  },
  { id: "chest", lifetime: 8 },
  { id: "relic" }, // immortal, manual-only
];

function createExtension(
  overrides: Partial<PickupsOptions<TestState>> = {},
): PickupsExtension<TestState> {
  return pickups<TestState>({
    definitions: DEFS,
    getData: (state) => state.pickups,
    setData: (state, data) => {
      state.pickups = data;
    },
    ...overrides,
  });
}

describe("wiring validation", () => {
  const wire = (definitions: PickupDef<TestState>[]): void => {
    pickups<TestState>({ definitions, getData: (s) => s.pickups, setData: () => {} });
  };

  it("throws on duplicate types and invalid numbers", () => {
    expect(() => wire([{ id: "a" }, { id: "a" }])).toThrow(/duplicate pickup type/);
    expect(() => wire([{ id: "a", lifetime: 0 }])).toThrow(/lifetime/);
    expect(() => wire([{ id: "a", lifetime: 5, spawn: { every: 0 } }])).toThrow(/spawn.every/);
    expect(() => wire([{ id: "a", lifetime: 5, spawn: { every: 1, max: 0 } }])).toThrow(
      /spawn.max/,
    );
  });

  it("requires auto-spawned types to be bounded (lifetime or max)", () => {
    expect(() => wire([{ id: "a", spawn: { every: 1 } }])).toThrow(/lifetime and\/or spawn.max/);
    expect(() => wire([{ id: "a", spawn: { every: 1, max: 5 } }])).not.toThrow();
    expect(() => wire([{ id: "a", lifetime: 5, spawn: { every: 1 } }])).not.toThrow();
  });
});

describe("manual spawn", () => {
  it("creates an item with a unique chronological id", () => {
    const plugin = createExtension();
    const state = createState();
    const first = plugin.spawn(state, "chest")!;
    const second = plugin.spawn(state, "chest")!;
    expect(first.id).toBe("chest#1");
    expect(second.id).toBe("chest#2");
    expect(state.pickups.items[first.id]).toBe(first);
  });

  it("returns undefined for an unknown type", () => {
    const plugin = createExtension();
    expect(plugin.spawn(createState(), "nope")).toBeUndefined();
  });

  it("applies the def lifetime, overridable per spawn", () => {
    const plugin = createExtension();
    const state = createState();
    expect(plugin.spawn(state, "chest")!.remaining).toBe(8);
    expect(plugin.spawn(state, "chest", { lifetime: 3 })!.remaining).toBe(3);
    expect(plugin.spawn(state, "relic")!.remaining).toBeUndefined();
  });

  it("uses the position factory with the persisted PRNG (deterministic)", () => {
    const stateA = createState();
    const stateB = createState();
    const itemA = createExtension().spawn(stateA, "scrap")!;
    const itemB = createExtension().spawn(stateB, "scrap")!;
    expect(itemA.position).toBeDefined();
    expect(itemA.position).toEqual(itemB.position); // same seed, same sequence
    expect(stateA.pickups.rngState).not.toBe(42); // PRNG state advanced and persisted
  });

  it("merges def metadata with spawn overrides", () => {
    const plugin = createExtension();
    const state = createState();
    const item = plugin.spawn(state, "scrap", { metadata: { image: "gold.gif", rare: true } })!;
    expect(item.metadata).toEqual({ image: "gold.gif", rare: true });
    expect(plugin.spawn(state, "scrap")!.metadata).toEqual({ image: "scrap.gif" });
  });

  it("notifies onSpawn", () => {
    const onSpawn = vi.fn();
    const plugin = createExtension({ onSpawn });
    const state = createState();
    const item = plugin.spawn(state, "chest");
    expect(onSpawn).toHaveBeenCalledWith(state, item);
  });
});

describe("automatic spawn", () => {
  it("spawns after each interval", () => {
    const plugin = createExtension();
    const state = createState();
    plugin.update?.(state, 3);
    expect(plugin.active(state, "scrap")).toBe(0);
    plugin.update?.(state, 1);
    expect(plugin.active(state, "scrap")).toBe(1);
    plugin.update?.(state, 4);
    expect(plugin.active(state, "scrap")).toBe(2);
  });

  it("respects spawn.max", () => {
    const plugin = createExtension();
    const state = createState();
    plugin.update?.(state, 19); // 4 intervals, but max 3
    expect(plugin.active(state, "scrap")).toBe(3);
  });

  it("accumulates no time while `when` is false (no burst on re-enable)", () => {
    const plugin = createExtension();
    const state = createState();
    state.population = 0;
    plugin.update?.(state, 100);
    expect(plugin.active(state, "scrap")).toBe(0);
    state.population = 5;
    plugin.update?.(state, 0.1);
    expect(plugin.active(state, "scrap")).toBe(0); // starts from zero, no dump
  });

  it("bounds a large offline dt: staggered survivors only, never above max", () => {
    const plugin = createExtension();
    const state = createState();
    plugin.update?.(state, 3600);
    const views = plugin.visible(state);
    expect(views.length).toBe(3); // capped by max, not 900 spawns
    // Countdowns are staggered as if they spawned 0/4/8 seconds ago.
    const remainings = views.map((view) => view.remaining).sort((a, b) => b! - a!);
    expect(remainings).toEqual([20, 16, 12]);
  });
});

describe("expiration", () => {
  it("removes due items and notifies onExpire", () => {
    const onExpire = vi.fn();
    const plugin = createExtension({ onExpire });
    const state = createState();
    const item = plugin.spawn(state, "chest")!; // lifetime 8
    plugin.update?.(state, 5);
    expect(plugin.status(state, item.id).kind).toBe("ready");
    plugin.update?.(state, 3);
    expect(plugin.status(state, item.id).kind).toBe("unknown");
    expect(state.pickups.items[item.id]).toBeUndefined();
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(onExpire.mock.calls[0][1].id).toBe(item.id);
  });

  it("immortal items never expire", () => {
    const plugin = createExtension();
    const state = createState();
    const item = plugin.spawn(state, "relic")!;
    plugin.update?.(state, 1e6);
    expect(plugin.status(state, item.id).kind).toBe("ready");
  });
});

describe("take / status / visible / active", () => {
  it("take removes and returns a ready item, never granting anything", () => {
    const plugin = createExtension();
    const state = createState();
    const item = plugin.spawn(state, "chest")!;
    const taken = plugin.take(state, item.id);
    expect(taken?.id).toBe(item.id);
    expect(state.pickups.items[item.id]).toBeUndefined();
    expect(plugin.take(state, item.id)).toBeUndefined(); // already gone
    expect(plugin.take(state, "nope")).toBeUndefined();
  });

  it("visible exposes active items with lifetimeFraction", () => {
    const plugin = createExtension();
    const state = createState();
    plugin.spawn(state, "chest"); // lifetime 8
    plugin.spawn(state, "relic"); // immortal
    plugin.update?.(state, 2);

    const views = plugin.visible(state);
    expect(views).toHaveLength(2);
    const chest = views.find((view) => view.type === "chest")!;
    expect(chest.lifetimeFraction).toBeCloseTo(0.25, 10);
    const relic = views.find((view) => view.type === "relic")!;
    expect(relic.lifetimeFraction).toBeUndefined();
  });

  it("active counts by type or overall", () => {
    const plugin = createExtension();
    const state = createState();
    plugin.spawn(state, "chest");
    plugin.spawn(state, "chest");
    plugin.spawn(state, "relic");
    expect(plugin.active(state)).toBe(3);
    expect(plugin.active(state, "chest")).toBe(2);
    expect(plugin.active(state, "scrap")).toBe(0);
  });
});
