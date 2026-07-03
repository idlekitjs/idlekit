import { describe, expect, it } from "vitest";
import { createEconomy, resourceAtLeast, type Economy } from "@idlekitjs/economy";
import { containers } from "../src/containers";
import type { ContainersData, ContainersExtension } from "../src/containers";
import {
  containerContentResources,
  containerFreeSpaceResource,
  containerHasSpace,
} from "../src/containers/economy";

interface TestState {
  storage: ContainersData;
}

function createState(): TestState {
  return { storage: { bin: { scrap: 8 } } };
}

function createContainers(): ContainersExtension<TestState> {
  return containers<TestState>({
    definitions: [{ id: "bin", capacity: 10 }],
    getData: (state) => state.storage,
    setData: (state, data) => {
      state.storage = data;
    },
  });
}

describe("containerHasSpace", () => {
  it("is met while the content fits, without mutating", () => {
    const bin = createContainers();
    const economy = createEconomy<TestState>();
    const requirement = containerHasSpace(bin, "bin", "scrap", 2);
    const state = createState();

    expect(requirement.isMet(state, economy)).toBe(true);
    expect(containerHasSpace(bin, "bin", "scrap", 3).isMet(state, economy)).toBe(false);
    expect(state.storage).toEqual({ bin: { scrap: 8 } });
  });

  it("exposes used/capacity progress", () => {
    const bin = createContainers();
    const economy = createEconomy<TestState>();
    const requirement = containerHasSpace(bin, "bin", "scrap");
    expect(requirement.progress?.(createState(), economy)).toEqual({ current: 8, target: 10 });
  });
});

describe("containerContentResources", () => {
  function createTestEconomy(bin: ContainersExtension<TestState>): Economy<TestState> {
    return createEconomy<TestState>()
      .resources(containerContentResources(bin, "bin", ["scrap", "glass"]))
      .resource(containerFreeSpaceResource(bin, "bin"));
  }

  it("reads and trades the container's own numbers", () => {
    const bin = createContainers();
    const economy = createTestEconomy(bin);
    const state = createState();

    expect(economy.get(state, "bin:scrap")).toBe(8);
    economy.add(state, "bin:scrap", 2);
    expect(bin.contents(state, "bin")).toEqual({ scrap: 10 });
    economy.add(state, "bin:scrap", -4);
    expect(bin.contents(state, "bin")).toEqual({ scrap: 6 });
  });

  it("throws when a credit exceeds the capacity (gate with containerHasSpace)", () => {
    const bin = createContainers();
    const economy = createTestEconomy(bin);
    const state = createState();
    expect(() => economy.add(state, "bin:scrap", 5)).toThrow(/over capacity/);
  });

  it("exposes free space as a readonly resource usable in requirements", () => {
    const bin = createContainers();
    const economy = createTestEconomy(bin);
    const state = createState();
    expect(economy.get(state, "bin:free-space")).toBe(2);
    expect(economy.resource("bin:free-space").readonly).toBe(true);
    expect(resourceAtLeast<TestState>("bin:free-space", 2).isMet(state, economy)).toBe(true);
    expect(resourceAtLeast<TestState>("bin:free-space", 3).isMet(state, economy)).toBe(false);
  });
});
