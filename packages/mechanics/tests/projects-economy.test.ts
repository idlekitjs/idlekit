import { describe, expect, it } from "vitest";
import { createEconomy, stateKey, type Economy, type Transaction } from "@idlekitjs/economy";
import { projectFromTransaction } from "../src/projects/economy";

interface TestState {
  potatoes: number;
  upgrades: string[];
}

function createTestEconomy(): Economy<TestState> {
  return createEconomy<TestState>({ format: (amount) => String(amount) }).resource({
    id: "currency:potatoes",
    label: "potatoes",
    accessor: stateKey("potatoes"),
  });
}

const transaction: Transaction<TestState> = {
  id: "project:better-plows",
  cost: [["currency:potatoes", 100]],
  apply: (state) => {
    state.upgrades.push("better-plows");
  },
};

describe("projectFromTransaction", () => {
  it("maps id, view fields and repeatable", () => {
    const project = projectFromTransaction(createTestEconomy(), transaction, {
      title: "Better plows",
      description: "Till twice the soil.",
      repeatable: true,
    });
    expect(project.id).toBe("project:better-plows");
    expect(project.title).toBe("Better plows");
    expect(project.repeatable).toBe(true);
    // Default trigger: always visible.
    expect(project.trigger({ potatoes: 0, upgrades: [] })).toBe(true);
  });

  it("affordable maps to canExecute (requirements included)", () => {
    const economy = createTestEconomy();
    const project = projectFromTransaction(economy, transaction, {
      title: "Better plows",
      description: "",
    });
    expect(project.affordable({ potatoes: 100, upgrades: [] })).toBe(true);
    expect(project.affordable({ potatoes: 99, upgrades: [] })).toBe(false);
  });

  it("effect executes the transaction (pay + apply)", () => {
    const economy = createTestEconomy();
    const project = projectFromTransaction(economy, transaction, {
      title: "Better plows",
      description: "",
    });
    const state: TestState = { potatoes: 150, upgrades: [] };
    project.effect(state);
    expect(state.potatoes).toBe(50);
    expect(state.upgrades).toEqual(["better-plows"]);
  });

  it("derives a cost label from the formatted cost lines", () => {
    const project = projectFromTransaction(createTestEconomy(), transaction, {
      title: "Better plows",
      description: "",
    });
    expect(project.cost?.({ potatoes: 0, upgrades: [] })).toBe("100 potatoes");
  });

  it("leaves cost undefined for cost-less transactions", () => {
    const project = projectFromTransaction(
      createTestEconomy(),
      { id: "free", apply: () => {} },
      { title: "Free", description: "" },
    );
    expect(project.cost).toBeUndefined();
  });
});
