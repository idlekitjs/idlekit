import { describe, it, expect } from "vitest";
import { ProjectManager } from "../src/projects";
import type { Project } from "../src/projects";

interface State {
  ops: number;
  boost: number;
}

function makeProjects(): Project<State>[] {
  return [
    {
      id: "p1",
      title: "Boost",
      description: "Increases the boost",
      trigger: () => true,
      affordable: (s) => s.ops >= 100,
      effect: (s) => {
        s.ops -= 100;
        s.boost += 1;
      },
    },
    {
      id: "p2",
      title: "Hidden",
      description: "Visible only after boost",
      trigger: (s) => s.boost >= 2,
      affordable: () => true,
      effect: (s) => {
        s.boost += 10;
      },
    },
    {
      id: "loop",
      title: "Repeatable",
      description: "Can be bought multiple times",
      trigger: () => true,
      affordable: (s) => s.ops >= 10,
      effect: (s) => {
        s.ops -= 10;
      },
      repeatable: true,
    },
  ];
}

describe("ProjectManager", () => {
  it("only exposes triggered projects", () => {
    const manager = new ProjectManager(makeProjects());
    const ids = manager.available({ ops: 0, boost: 0 }).map((p) => p.id);
    expect(ids).toContain("p1");
    expect(ids).not.toContain("p2");
  });

  it("rejects an unaffordable purchase", () => {
    const manager = new ProjectManager(makeProjects());
    const state = { ops: 50, boost: 0 };
    expect(manager.complete("p1", state)).toBe(false);
    expect(state.boost).toBe(0);
  });

  it("applies the effect and marks the project completed", () => {
    const manager = new ProjectManager(makeProjects());
    const state = { ops: 100, boost: 0 };
    expect(manager.complete("p1", state)).toBe(true);
    expect(state.boost).toBe(1);
    expect(state.ops).toBe(0);
    expect(manager.isCompleted("p1")).toBe(true);
  });

  it("removes a completed project from the available list", () => {
    const manager = new ProjectManager(makeProjects());
    const state = { ops: 100, boost: 0 };
    manager.complete("p1", state);
    expect(manager.available(state).map((p) => p.id)).not.toContain("p1");
  });

  it("keeps a repeatable project available after purchase", () => {
    const manager = new ProjectManager(makeProjects());
    const state = { ops: 100, boost: 0 };
    expect(manager.complete("loop", state)).toBe(true);
    expect(manager.complete("loop", state)).toBe(true);
    expect(manager.available(state).map((p) => p.id)).toContain("loop");
  });

  it("persists and restores completed projects", () => {
    const manager = new ProjectManager(makeProjects());
    const state = { ops: 100, boost: 0 };
    manager.complete("p1", state);

    const restored = new ProjectManager(makeProjects());
    restored.restore(manager.completedIds());
    expect(restored.isCompleted("p1")).toBe(true);
  });
});
