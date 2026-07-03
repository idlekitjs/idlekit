import { describe, expect, it } from "vitest";
import {
  allOf,
  createEconomy,
  not,
  resourceAtLeast,
  resourceAtMost,
  stateKey,
  type Requirement,
} from "../src";

interface TestState {
  gold: number;
  claimed: boolean;
}

const economy = createEconomy<TestState>().resource({
  id: "currency:gold",
  accessor: stateKey("gold"),
});

describe("resourceAtLeast", () => {
  it("checks the balance without consuming it", () => {
    const requirement = resourceAtLeast<TestState>("currency:gold", 50);
    const state: TestState = { gold: 60, claimed: false };
    expect(requirement.isMet(state, economy)).toBe(true);
    expect(state.gold).toBe(60);
    state.gold = 40;
    expect(requirement.isMet(state, economy)).toBe(false);
  });

  it("exposes progress for the UI", () => {
    const requirement = resourceAtLeast<TestState>("currency:gold", 50);
    expect(requirement.progress?.({ gold: 20, claimed: false }, economy)).toEqual({
      current: 20,
      target: 50,
    });
  });
});

describe("resourceAtMost", () => {
  it("checks the upper bound", () => {
    const requirement = resourceAtMost<TestState>("currency:gold", 10);
    expect(requirement.isMet({ gold: 10, claimed: false }, economy)).toBe(true);
    expect(requirement.isMet({ gold: 11, claimed: false }, economy)).toBe(false);
  });
});

describe("allOf / not", () => {
  const custom: Requirement<TestState> = {
    id: "claimed",
    isMet: (state) => state.claimed,
  };

  it("allOf is met when every requirement is", () => {
    const requirement = allOf(resourceAtLeast<TestState>("currency:gold", 5), custom);
    expect(requirement.isMet({ gold: 10, claimed: true }, economy)).toBe(true);
    expect(requirement.isMet({ gold: 10, claimed: false }, economy)).toBe(false);
    expect(requirement.isMet({ gold: 1, claimed: true }, economy)).toBe(false);
  });

  it("not inverts a requirement and can carry a label", () => {
    const requirement = not(custom, "Not claimed yet");
    expect(requirement.isMet({ gold: 0, claimed: false }, economy)).toBe(true);
    expect(requirement.isMet({ gold: 0, claimed: true }, economy)).toBe(false);
    expect(requirement.label).toBe("Not claimed yet");
  });

  it("custom predicates can ignore the economy argument", () => {
    expect(custom.isMet({ gold: 0, claimed: true }, economy)).toBe(true);
  });
});
