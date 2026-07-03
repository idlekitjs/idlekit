import { describe, it, expect, vi } from "vitest";
import { createEngine } from "@idlekitjs/core";
import { ModifierRegistry } from "../src/modifiers";
import { boosts, type ActiveBoost, type BoostDef, type BoostsOptions } from "../src/boosts";

interface TestState {
  active: Record<string, ActiveBoost>;
}

const DEFINITIONS: BoostDef[] = [
  {
    id: "double-production",
    duration: 30,
    effects: [{ target: { kind: "all" }, stat: "yield", op: "mult", value: 2 }],
  },
  {
    id: "coffee",
    duration: 10,
    maxDuration: 25,
    stacking: "extend",
    effects: [{ target: { kind: "tag", tag: "worker" }, stat: "speed", op: "mult", value: 1.5 }],
  },
  {
    id: "frenzy",
    duration: 8,
    stacking: "stack",
    maxStacks: 3,
    effects: [{ target: { kind: "all" }, stat: "yield", op: "add", value: 0.5 }],
  },
  {
    id: "sabotage",
    duration: 5,
    effects: [{ target: { kind: "id", id: "mine" }, stat: "speed", op: "mult", value: 0.5 }],
  },
  { id: "plain-status", duration: 12 }, // no effects: pure timed status
];

function makeState(): TestState {
  return { active: {} };
}

function makeBoosts(overrides: Partial<BoostsOptions<TestState>> = {}) {
  return boosts<TestState>({
    definitions: DEFINITIONS,
    getActive: (state) => state.active,
    setActive: (state, active) => {
      state.active = active;
    },
    ...overrides,
  });
}

describe("boosts definitions validation", () => {
  it("throws on duplicate ids", () => {
    expect(() =>
      makeBoosts({
        definitions: [
          { id: "x", duration: 1 },
          { id: "x", duration: 2 },
        ],
      }),
    ).toThrow(/duplicate boost id/);
  });

  it("throws on a non-positive or non-finite duration", () => {
    for (const duration of [0, -3, NaN, Infinity]) {
      expect(() => makeBoosts({ definitions: [{ id: "x", duration }] })).toThrow(
        /finite duration > 0/,
      );
    }
  });

  it("throws when maxDuration is below duration", () => {
    expect(() => makeBoosts({ definitions: [{ id: "x", duration: 10, maxDuration: 5 }] })).toThrow(
      /maxDuration >= duration/,
    );
  });

  it("throws on an invalid maxStacks", () => {
    for (const maxStacks of [0, -1, 1.5]) {
      expect(() => makeBoosts({ definitions: [{ id: "x", duration: 1, maxStacks }] })).toThrow(
        /integer maxStacks >= 1/,
      );
    }
  });
});

describe("boosts grant / query", () => {
  it("throws on an unknown boost id (static-data error)", () => {
    const ext = makeBoosts();
    expect(() => ext.grant(makeState(), "nonexistent")).toThrow(/unknown boost "nonexistent"/);
  });

  it("grants a boost and exposes it through the queries", () => {
    const onGrant = vi.fn();
    const ext = makeBoosts({ onGrant });
    const state = makeState();

    const entry = ext.grant(state, "double-production");
    expect(entry).toEqual({ id: "double-production", remaining: 30, stacks: 1 });
    expect(ext.isActive(state, "double-production")).toBe(true);
    expect(ext.get(state, "double-production")).toEqual(entry);
    expect(ext.active(state)).toEqual([entry]);
    expect(onGrant).toHaveBeenCalledWith(entry, state);

    // Plain JSON data: survives a save round-trip untouched.
    expect(JSON.parse(JSON.stringify(state.active))).toEqual(state.active);
  });

  it("refresh policy (default): re-grant resets the timer", () => {
    const ext = makeBoosts();
    const state = makeState();
    ext.grant(state, "double-production");
    ext.update?.(state, 25);
    expect(ext.get(state, "double-production")?.remaining).toBe(5);

    ext.grant(state, "double-production");
    expect(ext.get(state, "double-production")).toEqual({
      id: "double-production",
      remaining: 30,
      stacks: 1,
    });
  });

  it("extend policy: re-grant adds time, capped by maxDuration", () => {
    const ext = makeBoosts();
    const state = makeState();
    ext.grant(state, "coffee"); // 10
    ext.grant(state, "coffee"); // 20
    ext.grant(state, "coffee"); // 30 -> capped at 25
    expect(ext.get(state, "coffee")?.remaining).toBe(25);
  });

  it("stack policy: re-grant adds a stack up to maxStacks and refreshes the timer", () => {
    const ext = makeBoosts();
    const state = makeState();
    ext.grant(state, "frenzy");
    ext.update?.(state, 6);
    ext.grant(state, "frenzy");
    expect(ext.get(state, "frenzy")).toEqual({ id: "frenzy", remaining: 8, stacks: 2 });

    ext.grant(state, "frenzy");
    ext.grant(state, "frenzy"); // beyond maxStacks 3
    expect(ext.get(state, "frenzy")?.stacks).toBe(3);
  });
});

describe("boosts timing", () => {
  it("update decrements remaining and expiration removes the boost", () => {
    const onExpire = vi.fn();
    const ext = makeBoosts({ onExpire });
    const state = makeState();
    ext.grant(state, "double-production");

    ext.update?.(state, 29);
    expect(ext.get(state, "double-production")?.remaining).toBeCloseTo(1, 9);
    expect(onExpire).not.toHaveBeenCalled();

    ext.update?.(state, 1);
    expect(ext.isActive(state, "double-production")).toBe(false);
    expect(ext.active(state)).toEqual([]);
    expect(onExpire).toHaveBeenCalledWith("double-production", state);
  });

  it("a large offline dt expires every due boost in one pass", () => {
    const ext = makeBoosts();
    const state = makeState();
    ext.grant(state, "double-production");
    ext.grant(state, "coffee");

    ext.update?.(state, 3_600);
    expect(ext.active(state)).toEqual([]);
  });

  it("extend() adds and subtracts time, capped by maxDuration", () => {
    const ext = makeBoosts();
    const state = makeState();
    ext.grant(state, "coffee"); // 10, cap 25

    expect(ext.extend(state, "coffee", 100)).toBe(true);
    expect(ext.get(state, "coffee")?.remaining).toBe(25);

    expect(ext.extend(state, "coffee", -20)).toBe(true);
    expect(ext.get(state, "coffee")?.remaining).toBe(5);

    expect(ext.extend(state, "nonexistent", 10)).toBe(false);
    expect(ext.extend(state, "double-production", 10)).toBe(false); // not active
  });

  it("a negative extend down to zero expires the boost", () => {
    const onExpire = vi.fn();
    const ext = makeBoosts({ onExpire });
    const state = makeState();
    ext.grant(state, "coffee");

    expect(ext.extend(state, "coffee", -999)).toBe(true);
    expect(ext.isActive(state, "coffee")).toBe(false);
    expect(onExpire).toHaveBeenCalledWith("coffee", state);
  });

  it("remove() deactivates without firing onExpire", () => {
    const onExpire = vi.fn();
    const ext = makeBoosts({ onExpire });
    const state = makeState();
    ext.grant(state, "double-production");

    expect(ext.remove(state, "double-production")).toBe(true);
    expect(ext.isActive(state, "double-production")).toBe(false);
    expect(onExpire).not.toHaveBeenCalled();

    expect(ext.remove(state, "double-production")).toBe(false); // already gone
  });
});

describe("boosts modifiers integration", () => {
  it("publishes effects while active and retracts them on expiry", () => {
    const registry = new ModifierRegistry();
    const ext = makeBoosts({ registry });
    const state = makeState();

    ext.grant(state, "double-production");
    expect(registry.resolve({ stat: "yield" })).toBe(2);

    ext.update?.(state, 30); // expires
    expect(registry.resolve({ stat: "yield" })).toBe(1); // no leak
  });

  it("retracts effects on manual remove", () => {
    const registry = new ModifierRegistry();
    const ext = makeBoosts({ registry });
    const state = makeState();

    ext.grant(state, "double-production");
    ext.remove(state, "double-production");
    expect(registry.resolve({ stat: "yield" })).toBe(1);
  });

  it("supports negative effects (debuffs) and targeted modifiers", () => {
    const registry = new ModifierRegistry();
    const ext = makeBoosts({ registry });
    const state = makeState();

    ext.grant(state, "sabotage"); // speed x0.5 on id "mine"
    expect(registry.resolve({ stat: "speed", id: "mine" })).toBe(0.5);
    expect(registry.resolve({ stat: "speed", id: "farm" })).toBe(1);

    ext.grant(state, "coffee"); // speed x1.5 on tag "worker"
    expect(registry.resolve({ stat: "speed", tags: ["worker"] })).toBe(1.5);
  });

  it("scales stacked effects: add linearly, mult compounded", () => {
    const registry = new ModifierRegistry();
    const ext = makeBoosts({
      registry,
      definitions: [
        ...DEFINITIONS,
        {
          id: "combo",
          duration: 10,
          stacking: "stack",
          effects: [{ target: { kind: "all" }, stat: "speed", op: "mult", value: 2 }],
        },
      ],
    });
    const state = makeState();

    ext.grant(state, "frenzy"); // add 0.5
    ext.grant(state, "frenzy"); // stacks 2 -> add 1.0
    expect(registry.resolve({ stat: "yield" })).toBe(2); // 1 + 1.0

    ext.grant(state, "combo"); // mult 2
    ext.grant(state, "combo"); // stacks 2 -> mult 4
    expect(registry.resolve({ stat: "speed" })).toBe(4);
  });

  it("works without a registry (pure timed status)", () => {
    const ext = makeBoosts();
    const state = makeState();
    ext.grant(state, "plain-status");
    ext.update?.(state, 5);
    expect(ext.get(state, "plain-status")?.remaining).toBe(7);
  });
});

describe("boosts save/load", () => {
  /** Wire the extension into a real engine and replay the `loaded` event. */
  function loadedEngine(active: Record<string, ActiveBoost>, registry?: ModifierRegistry) {
    const ext = makeBoosts({ registry });
    const engine = createEngine<TestState>({ initialState: makeState() });
    engine.use(ext);
    engine.state.active = active;
    engine.events.emit("loaded", Date.now());
    return { ext, state: engine.state };
  }

  it("republishes modifiers for active boosts on load", () => {
    const registry = new ModifierRegistry();
    const { ext, state } = loadedEngine(
      { "double-production": { id: "double-production", remaining: 12, stacks: 1 } },
      registry,
    );

    expect(registry.resolve({ stat: "yield" })).toBe(2);

    ext.update?.(state, 12); // continues and expires normally
    expect(registry.resolve({ stat: "yield" })).toBe(1);
  });

  it("heals a stale save: unknown ids dropped, remaining/stacks clamped", () => {
    const { state } = loadedEngine({
      removed: { id: "removed", remaining: 10, stacks: 1 },
      "double-production": { id: "double-production", remaining: NaN, stacks: 1 },
      coffee: { id: "coffee", remaining: 999, stacks: 1 }, // above maxDuration 25
      frenzy: { id: "frenzy", remaining: 4, stacks: 42 }, // above maxStacks 3
    });

    expect(state.active).toEqual({
      coffee: { id: "coffee", remaining: 25, stacks: 1 },
      frenzy: { id: "frenzy", remaining: 4, stacks: 3 },
    });
  });
});
