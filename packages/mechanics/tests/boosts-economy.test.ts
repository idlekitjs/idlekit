import { describe, expect, it } from "vitest";
import { createEconomy, stateKey, type Economy } from "@idlekitjs/economy";
import { boosts } from "../src/boosts";
import type { ActiveBoost, BoostsExtension } from "../src/boosts";
import { activateBoost, boostTokenResourceId } from "../src/boosts/economy";

interface TestState {
  doubleTokens: number;
  active: Record<string, ActiveBoost>;
}

function createTestEconomy(): Economy<TestState> {
  return createEconomy<TestState>().resource({
    id: boostTokenResourceId("double-production"),
    accessor: stateKey("doubleTokens"),
    integer: true,
  });
}

function createBoosts(): BoostsExtension<TestState> {
  return boosts<TestState>({
    definitions: [{ id: "double-production", duration: 30 }],
    getActive: (state) => state.active,
    setActive: (state, active) => {
      state.active = active;
    },
  });
}

describe("boostTokenResourceId", () => {
  it("derives the boost-token namespace", () => {
    expect(boostTokenResourceId("double-production")).toBe("boost-token:double-production");
  });
});

describe("activateBoost", () => {
  it("spends one token and grants the boost", () => {
    const economy = createTestEconomy();
    const plugin = createBoosts();
    const state: TestState = { doubleTokens: 2, active: {} };

    const result = economy.execute(state, activateBoost(plugin, { boostId: "double-production" }));

    expect(result.ok).toBe(true);
    expect(state.doubleTokens).toBe(1);
    expect(plugin.isActive(state, "double-production")).toBe(true);
    expect(state.active["double-production"].remaining).toBe(30);
  });

  it("fails with diagnostics when out of tokens, granting nothing", () => {
    const economy = createTestEconomy();
    const plugin = createBoosts();
    const state: TestState = { doubleTokens: 0, active: {} };

    const transaction = activateBoost(plugin, { boostId: "double-production" });
    expect(economy.canExecute(state, transaction)).toBe(false);
    const result = economy.execute(state, transaction);
    expect(result.ok).toBe(false);
    expect(plugin.isActive(state, "double-production")).toBe(false);
  });

  it("supports custom token id and count", () => {
    const economy = createEconomy<TestState>().resource({
      id: "currency:stars",
      accessor: stateKey("doubleTokens"),
    });
    const plugin = createBoosts();
    const state: TestState = { doubleTokens: 5, active: {} };

    const result = economy.execute(
      state,
      activateBoost(plugin, { boostId: "double-production", tokenId: "currency:stars", tokens: 3 }),
    );
    expect(result.ok).toBe(true);
    expect(state.doubleTokens).toBe(2);
  });
});
