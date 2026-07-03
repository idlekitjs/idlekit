import { describe, expect, it } from "vitest";
import { defineResource, EconomyError, readonly, stateKey } from "../src";

interface TestState {
  gold: number;
}

describe("defineResource", () => {
  it("normalizes the inline get/add syntax", () => {
    const def = defineResource<TestState>({
      id: "currency:gold",
      get: (state) => state.gold,
      add: (state, amount) => {
        state.gold += amount;
      },
    });

    const state: TestState = { gold: 5 };
    expect(def.accessor.get(state)).toBe(5);
    def.accessor.add(state, 3);
    expect(state.gold).toBe(8);
  });

  it("normalizes the accessor syntax to the same shape", () => {
    const def = defineResource<TestState>({
      id: "currency:gold",
      accessor: stateKey("gold"),
    });

    const state: TestState = { gold: 5 };
    def.accessor.add(state, -2);
    expect(def.accessor.get(state)).toBe(3);
  });

  it("resolves defaults: label=id, integer=false, min=0, max=Infinity, tags=[]", () => {
    const def = defineResource<TestState>({ id: "currency:gold", accessor: stateKey("gold") });

    expect(def.label).toBe("currency:gold");
    expect(def.integer).toBe(false);
    expect(def.min).toBe(0);
    expect(def.max).toBe(Infinity);
    expect(def.readonly).toBe(false);
    expect(def.tags).toEqual([]);
  });

  it("keeps explicit fields", () => {
    const format = (amount: number): string => `${amount}g`;
    const def = defineResource<TestState>({
      id: "currency:gold",
      label: "Gold",
      description: "Shiny.",
      accessor: stateKey("gold"),
      format,
      integer: true,
      min: 0,
      max: 100,
      tags: ["currency"],
      metadata: { icon: "gold.png" },
    });

    expect(def.label).toBe("Gold");
    expect(def.format).toBe(format);
    expect(def.integer).toBe(true);
    expect(def.max).toBe(100);
    expect(def.tags).toEqual(["currency"]);
    expect(def.metadata).toEqual({ icon: "gold.png" });
  });

  it("marks resources built on the readonly accessor", () => {
    const def = defineResource<TestState>({
      id: "stat:rank",
      accessor: readonly((state) => state.gold * 2),
    });
    expect(def.readonly).toBe(true);
  });

  it("throws on invalid ids at wiring time", () => {
    const accessor = stateKey<TestState>("gold");
    expect(() => defineResource<TestState>({ id: "", accessor })).toThrow(EconomyError);
    expect(() => defineResource<TestState>({ id: "has space", accessor })).toThrow(EconomyError);
    expect(() => defineResource<TestState>({ id: ":gold", accessor })).toThrow(EconomyError);
    expect(() => defineResource<TestState>({ id: "gold:", accessor })).toThrow(EconomyError);
  });

  it("throws on invalid bounds", () => {
    const accessor = stateKey<TestState>("gold");
    expect(() =>
      defineResource<TestState>({ id: "currency:gold", accessor, min: 10, max: 5 }),
    ).toThrow(EconomyError);
    expect(() =>
      defineResource<TestState>({ id: "currency:gold", accessor, min: NaN }),
    ).toThrow(EconomyError);
  });
});
