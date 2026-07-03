import { describe, expect, it } from "vitest";
import { createEconomy, type Economy } from "@idlekitjs/economy";
import { crafting } from "../src/crafting";
import type { CraftingJob, RecipeDef, ResourceBag } from "../src/crafting";
import {
  amountsToBag,
  bagToAmounts,
  craftingResources,
  recipeCost,
  recipeReward,
} from "../src/crafting/economy";

interface TestState {
  resources: ResourceBag;
  jobs: CraftingJob[];
}

const RECIPE: RecipeDef = {
  id: "smelt-iron",
  inputs: { ore: 3, coal: 1 },
  outputs: { iron: 1 },
  duration: 10,
};

function createState(): TestState {
  return { resources: { ore: 10, coal: 5, iron: 0 }, jobs: [] };
}

const stock = {
  getResources: (state: TestState): ResourceBag => state.resources,
  setResources: (state: TestState, resources: ResourceBag): void => {
    state.resources = resources;
  },
};

function createTestEconomy(): Economy<TestState> {
  return createEconomy<TestState>().resources(
    craftingResources(["ore", "coal", "iron"], stock),
  );
}

describe("bagToAmounts / amountsToBag", () => {
  it("round-trips a bag", () => {
    const bag: ResourceBag = { ore: 3, coal: 1 };
    expect(amountsToBag(bagToAmounts(bag))).toEqual(bag);
  });

  it("drops zero entries and maps keys", () => {
    expect(bagToAmounts({ ore: 2, iron: 0 }, (key) => `item:${key}`)).toEqual([
      { resourceId: "item:ore", amount: 2 },
    ]);
    expect(amountsToBag([["item:ore", 2]], (id) => id.replace("item:", ""))).toEqual({
      ore: 2,
    });
  });
});

describe("recipeCost / recipeReward", () => {
  it("expose recipe inputs/outputs as cost/reward", () => {
    expect(recipeCost(RECIPE)).toEqual([
      { resourceId: "ore", amount: 3 },
      { resourceId: "coal", amount: 1 },
    ]);
    expect(recipeReward(RECIPE)).toEqual([{ resourceId: "iron", amount: 1 }]);
  });
});

describe("craftingResources", () => {
  it("reads and writes the same bag, reassigned for reactivity", () => {
    const economy = createTestEconomy();
    const state = createState();
    expect(economy.get(state, "ore")).toBe(10);

    const before = state.resources;
    economy.add(state, "ore", -4);
    expect(state.resources).not.toBe(before);
    expect(state.resources.ore).toBe(6);
  });

  it("observes balances mutated by the crafting mechanic (single source of truth)", () => {
    const economy = createTestEconomy();
    const state = createState();
    const plugin = crafting<TestState>({
      recipes: [RECIPE],
      machines: [{ id: "furnace" }],
      getResources: stock.getResources,
      setResources: stock.setResources,
      getJobs: (current) => current.jobs,
      setJobs: (current, jobs) => {
        current.jobs = jobs;
      },
    });

    // The mechanic pays the inputs itself on start...
    const status = plugin.start(state, "smelt-iron", "furnace");
    expect(status.kind).toBe("crafting");
    expect(economy.get(state, "ore")).toBe(7);
    expect(economy.get(state, "coal")).toBe(4);

    // ...and the economy can display it as a cost the player can re-afford.
    expect(economy.canAfford(state, recipeCost(RECIPE))).toBe(true);

    // Completion credits outputs into the same bag.
    plugin.update?.(state, 10);
    expect(economy.get(state, "iron")).toBe(1);
  });
});
