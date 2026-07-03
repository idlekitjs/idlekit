import { describe, expect, it, vi } from "vitest";
import {
  arrayIndex,
  computed,
  EconomyError,
  readonly,
  recordField,
  stateKey,
} from "../src";

interface CardEntry {
  level: number;
  shards: number;
}

interface TestState {
  gold: number;
  name: string;
  totals: number[];
  cards: Record<string, CardEntry>;
}

function createState(): TestState {
  return {
    gold: 10,
    name: "test",
    totals: [1, 2.5, 0],
    cards: { manager: { level: 1, shards: 4 } },
  };
}

describe("stateKey", () => {
  it("reads and writes a top-level number field in place", () => {
    const accessor = stateKey<TestState>("gold");
    const state = createState();
    expect(accessor.get(state)).toBe(10);
    accessor.add(state, 5);
    expect(state.gold).toBe(15);
    accessor.add(state, -3);
    expect(state.gold).toBe(12);
  });

  it("rejects non-number keys at the type level", () => {
    // @ts-expect-error "name" is a string field, not a number
    stateKey<TestState>("name");
    // @ts-expect-error "cards" is a record field, not a number
    stateKey<TestState>("cards");
  });
});

describe("arrayIndex", () => {
  it("reads a slot, defaulting missing indices to 0", () => {
    const accessor = arrayIndex<TestState>({
      getArray: (state) => state.totals,
      setArray: (state, totals) => {
        state.totals = totals;
      },
      index: 7,
    });
    expect(accessor.get(createState())).toBe(0);
  });

  it("clones the array and reassigns through setArray", () => {
    const setArray = vi.fn((state: TestState, totals: number[]) => {
      state.totals = totals;
    });
    const accessor = arrayIndex<TestState>({
      getArray: (state) => state.totals,
      setArray,
      index: 1,
    });

    const state = createState();
    const before = state.totals;
    accessor.add(state, 2);

    expect(setArray).toHaveBeenCalledTimes(1);
    expect(state.totals).not.toBe(before);
    expect(before[1]).toBe(2.5);
    expect(state.totals[1]).toBe(4.5);
  });
});

describe("recordField", () => {
  const options = {
    getRecord: (state: TestState) => state.cards,
    setRecord: (state: TestState, cards: Record<string, CardEntry>) => {
      state.cards = cards;
    },
    defaultEntry: (): CardEntry => ({ level: 0, shards: 0 }),
  };

  it("reads a field of an existing entry", () => {
    const accessor = recordField<TestState, CardEntry>({
      ...options,
      key: "manager",
      field: "shards",
    });
    expect(accessor.get(createState())).toBe(4);
  });

  it("falls back to the default entry on reads of a missing key", () => {
    const accessor = recordField<TestState, CardEntry>({
      ...options,
      key: "unknown",
      field: "shards",
    });
    expect(accessor.get(createState())).toBe(0);
  });

  it("creates the default entry on first write and reassigns both levels", () => {
    const accessor = recordField<TestState, CardEntry>({
      ...options,
      key: "fresh",
      field: "shards",
    });
    const state = createState();
    const beforeRecord = state.cards;
    accessor.add(state, 3);

    expect(state.cards).not.toBe(beforeRecord);
    expect(state.cards.fresh).toEqual({ level: 0, shards: 3 });
    // Untouched entries are carried over.
    expect(state.cards.manager).toEqual({ level: 1, shards: 4 });
  });

  it("clones the targeted entry instead of mutating it", () => {
    const accessor = recordField<TestState, CardEntry>({
      ...options,
      key: "manager",
      field: "shards",
    });
    const state = createState();
    const beforeEntry = state.cards.manager;
    accessor.add(state, 1);

    expect(beforeEntry.shards).toBe(4);
    expect(state.cards.manager.shards).toBe(5);
  });
});

describe("computed", () => {
  it("passes through any get/add pair", () => {
    const accessor = computed<TestState>({
      get: (state) => state.gold * 2,
      add: (state, amount) => {
        state.gold += amount / 2;
      },
    });
    const state = createState();
    expect(accessor.get(state)).toBe(20);
    accessor.add(state, 10);
    expect(state.gold).toBe(15);
  });
});

describe("readonly", () => {
  it("reads normally and throws on add", () => {
    const accessor = readonly<TestState>((state) => state.totals.length);
    const state = createState();
    expect(accessor.get(state)).toBe(3);
    expect(() => accessor.add(state, 1)).toThrow(EconomyError);
  });

  it("carries the readonly marker", () => {
    const accessor = readonly<TestState>((state) => state.gold);
    expect(accessor.readonly).toBe(true);
  });
});
