import { describe, it, expect } from "vitest";
import { ModifierRegistry } from "../src";

describe("ModifierRegistry", () => {
  it("returns the base value when there is no modifier", () => {
    const registry = new ModifierRegistry();
    expect(registry.resolve({ stat: "yield", base: 1 })).toBe(1);
    expect(registry.resolve({ stat: "yield", base: 5 })).toBe(5);
    expect(registry.resolve({ stat: "yield" })).toBe(1); // base defaults to 1
  });

  it("applies the (base + Σadd) × Πmult formula", () => {
    const registry = new ModifierRegistry();
    registry.set("a", [{ target: { kind: "all" }, stat: "yield", op: "add", value: 0.5 }]);
    registry.set("b", [{ target: { kind: "all" }, stat: "yield", op: "mult", value: 2 }]);
    registry.set("c", [{ target: { kind: "all" }, stat: "yield", op: "mult", value: 3 }]);

    // (1 + 0.5) * (2 * 3) = 9
    expect(registry.resolve({ stat: "yield", base: 1 })).toBe(9);
  });

  it("filters by stat", () => {
    const registry = new ModifierRegistry();
    registry.set("a", [{ target: { kind: "all" }, stat: "speed", op: "mult", value: 4 }]);
    expect(registry.resolve({ stat: "yield", base: 1 })).toBe(1);
    expect(registry.resolve({ stat: "speed", base: 1 })).toBe(4);
  });

  it("targets by id", () => {
    const registry = new ModifierRegistry();
    registry.set("a", [
      { target: { kind: "id", id: "miner" }, stat: "yield", op: "mult", value: 2 },
    ]);
    expect(registry.resolve({ stat: "yield", id: "miner" })).toBe(2);
    expect(registry.resolve({ stat: "yield", id: "farmer" })).toBe(1);
  });

  it("targets by tag", () => {
    const registry = new ModifierRegistry();
    registry.set("a", [
      { target: { kind: "tag", tag: "gatherer" }, stat: "yield", op: "mult", value: 3 },
    ]);
    expect(registry.resolve({ stat: "yield", tags: ["gatherer"] })).toBe(3);
    expect(registry.resolve({ stat: "yield", tags: ["builder"] })).toBe(1);
    expect(registry.resolve({ stat: "yield" })).toBe(1); // no tags
  });

  it("combines all/id/tag contributions on the same query", () => {
    const registry = new ModifierRegistry();
    registry.set("global", [{ target: { kind: "all" }, stat: "yield", op: "mult", value: 2 }]);
    registry.set("byId", [
      { target: { kind: "id", id: "miner" }, stat: "yield", op: "mult", value: 5 },
    ]);
    registry.set("byTag", [
      { target: { kind: "tag", tag: "gatherer" }, stat: "yield", op: "add", value: 1 },
    ]);

    // (1 + 1) * (2 * 5) = 20
    expect(registry.resolve({ stat: "yield", id: "miner", tags: ["gatherer"] })).toBe(20);
  });

  it("replaces a source's modifiers atomically with set()", () => {
    const registry = new ModifierRegistry();
    registry.set("up", [{ target: { kind: "all" }, stat: "yield", op: "mult", value: 2 }]);
    expect(registry.resolve({ stat: "yield" })).toBe(2);

    registry.set("up", [{ target: { kind: "all" }, stat: "yield", op: "mult", value: 8 }]);
    expect(registry.resolve({ stat: "yield" })).toBe(8); // not 16

    registry.set("up", []); // empty removes the source
    expect(registry.resolve({ stat: "yield" })).toBe(1);
  });

  it("supports multiple effects from a single source", () => {
    const registry = new ModifierRegistry();
    registry.set("card", [
      { target: { kind: "id", id: "miner" }, stat: "yield", op: "mult", value: 2 },
      { target: { kind: "id", id: "miner" }, stat: "speed", op: "mult", value: 1.5 },
    ]);
    expect(registry.resolve({ stat: "yield", id: "miner" })).toBe(2);
    expect(registry.resolve({ stat: "speed", id: "miner" })).toBe(1.5);
  });

  it("removes a source with remove()", () => {
    const registry = new ModifierRegistry();
    registry.set("a", [{ target: { kind: "all" }, stat: "yield", op: "mult", value: 7 }]);
    registry.remove("a");
    expect(registry.resolve({ stat: "yield" })).toBe(1);
  });
});
