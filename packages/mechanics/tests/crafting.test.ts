import { describe, it, expect, vi } from "vitest";
import { createEngine } from "@idlekitjs/core";
import {
  crafting,
  addResources,
  subtractResources,
  canAfford,
  missingResources,
  type CraftingJob,
  type CraftingOptions,
  type MachineDef,
  type RecipeDef,
  type ResourceBag,
} from "../src/crafting";

interface TestState {
  resources: ResourceBag;
  jobs: CraftingJob[];
}

const RECIPES: RecipeDef[] = [
  {
    id: "sandwich",
    inputs: { bread: 2, cheese: 1 },
    outputs: { sandwich: 1 },
    duration: 10,
    machineType: "kitchen",
  },
  {
    id: "juice",
    inputs: { orange: 3 },
    outputs: { juice: 1, pulp: 2 },
    duration: 4,
    machineType: "press",
  },
  // Untyped recipe: runs on any machine.
  { id: "chop", inputs: {}, outputs: { firewood: 1 }, duration: 2 },
];

const MACHINES: MachineDef[] = [
  { id: "kitchen-1", type: "kitchen" },
  { id: "kitchen-2", type: "kitchen" },
  { id: "press-1", type: "press" },
  { id: "bench" },
];

function makeState(resources: ResourceBag = { bread: 10, cheese: 5, orange: 9 }): TestState {
  return { resources, jobs: [] };
}

function makeCrafting(overrides: Partial<CraftingOptions<TestState>> = {}) {
  return crafting<TestState>({
    recipes: RECIPES,
    machines: MACHINES,
    getResources: (state) => state.resources,
    setResources: (state, resources) => {
      state.resources = resources;
    },
    getJobs: (state) => state.jobs,
    setJobs: (state, jobs) => {
      state.jobs = jobs;
    },
    ...overrides,
  });
}

describe("ResourceBag helpers", () => {
  it("addResources merges without mutating", () => {
    const bag = { wood: 1 };
    const result = addResources(bag, { wood: 2, stone: 3 });
    expect(result).toEqual({ wood: 3, stone: 3 });
    expect(bag).toEqual({ wood: 1 });
  });

  it("subtractResources removes without mutating or clamping", () => {
    const bag = { wood: 5 };
    expect(subtractResources(bag, { wood: 2, stone: 1 })).toEqual({ wood: 3, stone: -1 });
    expect(bag).toEqual({ wood: 5 });
  });

  it("canAfford treats missing keys as zero", () => {
    expect(canAfford({ wood: 2 }, { wood: 2 })).toBe(true);
    expect(canAfford({ wood: 2 }, { wood: 3 })).toBe(false);
    expect(canAfford({}, { wood: 1 })).toBe(false);
    expect(canAfford({ wood: 1 }, {})).toBe(true);
  });

  it("missingResources reports only the shortfall", () => {
    expect(missingResources({ wood: 1, stone: 9 }, { wood: 3, stone: 2 })).toEqual({ wood: 2 });
    expect(missingResources({ wood: 3 }, { wood: 3 })).toEqual({});
  });
});

describe("crafting definitions validation", () => {
  it("throws on duplicate recipe ids", () => {
    expect(() =>
      makeCrafting({ recipes: [RECIPES[0], { ...RECIPES[1], id: "sandwich" }] }),
    ).toThrow(/duplicate recipe id/);
  });

  it("throws on duplicate machine ids", () => {
    expect(() => makeCrafting({ machines: [{ id: "kitchen-1" }, { id: "kitchen-1" }] })).toThrow(
      /duplicate machine id/,
    );
  });

  it("throws on a non-positive or non-finite duration", () => {
    for (const duration of [0, -1, NaN, Infinity]) {
      expect(() =>
        makeCrafting({ recipes: [{ id: "bad", inputs: {}, outputs: {}, duration }] }),
      ).toThrow(/finite duration > 0/);
    }
  });

  it("throws on negative input/output amounts", () => {
    expect(() =>
      makeCrafting({
        recipes: [{ id: "bad", inputs: { wood: -1 }, outputs: {}, duration: 1 }],
      }),
    ).toThrow(/invalid inputs amount/);
  });
});

describe("crafting status", () => {
  it("is ready when recipe, machine, type and inputs line up", () => {
    const ext = makeCrafting();
    expect(ext.status(makeState(), "sandwich", "kitchen-1")).toEqual({ kind: "ready" });
    expect(ext.canStart(makeState(), "sandwich", "kitchen-1")).toBe(true);
  });

  it("reports an unknown recipe", () => {
    const ext = makeCrafting();
    expect(ext.status(makeState(), "cake", "kitchen-1")).toEqual({ kind: "unknown-recipe" });
  });

  it("reports an unknown machine", () => {
    const ext = makeCrafting();
    expect(ext.status(makeState(), "sandwich", "kitchen-9")).toEqual({ kind: "unknown-machine" });
  });

  it("reports a wrong machine type (including untyped machines)", () => {
    const ext = makeCrafting();
    expect(ext.status(makeState(), "sandwich", "press-1")).toEqual({
      kind: "wrong-machine-type",
      required: "kitchen",
      actual: "press",
    });
    expect(ext.status(makeState(), "sandwich", "bench")).toEqual({
      kind: "wrong-machine-type",
      required: "kitchen",
      actual: undefined,
    });
  });

  it("lets an untyped recipe run on any machine", () => {
    const ext = makeCrafting();
    for (const machineId of ["kitchen-1", "press-1", "bench"]) {
      expect(ext.status(makeState(), "chop", machineId)).toEqual({ kind: "ready" });
    }
  });

  it("reports missing inputs with the exact shortfall", () => {
    const ext = makeCrafting();
    const state = makeState({ bread: 1 });
    expect(ext.status(state, "sandwich", "kitchen-1")).toEqual({
      kind: "missing-inputs",
      missing: { bread: 1, cheese: 1 },
    });
  });

  it("reports machine-busy for another recipe and crafting for the same one", () => {
    const ext = makeCrafting();
    const state = makeState();
    ext.start(state, "sandwich", "kitchen-1");

    const same = ext.status(state, "sandwich", "kitchen-1");
    expect(same.kind).toBe("crafting");

    const other = ext.status(state, "chop", "kitchen-1");
    expect(other).toEqual({ kind: "machine-busy", jobId: "kitchen-1:sandwich" });
  });
});

describe("crafting jobs", () => {
  it("start consumes the inputs and creates a serializable job", () => {
    const onStart = vi.fn();
    const ext = makeCrafting({ onStart });
    const state = makeState();

    const result = ext.start(state, "sandwich", "kitchen-1");
    expect(result.kind).toBe("crafting");
    expect(state.resources).toEqual({ bread: 8, cheese: 4, orange: 9 });
    expect(state.jobs).toEqual([
      {
        id: "kitchen-1:sandwich",
        recipeId: "sandwich",
        machineId: "kitchen-1",
        elapsed: 0,
        duration: 10,
      },
    ]);
    // Plain JSON data: survives a save round-trip untouched.
    expect(JSON.parse(JSON.stringify(state.jobs))).toEqual(state.jobs);
    expect(onStart).toHaveBeenCalledWith(state.jobs[0], state);
  });

  it("start returns the blocking status and touches nothing when refused", () => {
    const ext = makeCrafting();
    const state = makeState({ bread: 0 });
    const result = ext.start(state, "sandwich", "kitchen-1");
    expect(result.kind).toBe("missing-inputs");
    expect(state.jobs).toEqual([]);
    expect(state.resources).toEqual({ bread: 0 });
  });

  it("supports a custom job id factory", () => {
    let n = 0;
    const ext = makeCrafting({ jobId: () => `job-${++n}` });
    const state = makeState();
    ext.start(state, "sandwich", "kitchen-1");
    ext.start(state, "sandwich", "kitchen-2");
    expect(state.jobs.map((job) => job.id)).toEqual(["job-1", "job-2"]);
  });

  it("update advances the job and completion credits the outputs", () => {
    const onComplete = vi.fn();
    const ext = makeCrafting({ onComplete });
    const state = makeState();
    ext.start(state, "sandwich", "kitchen-1");

    ext.update?.(state, 4);
    expect(ext.progressFraction(state, "kitchen-1")).toBeCloseTo(0.4);
    expect(state.resources.sandwich).toBeUndefined();

    ext.update?.(state, 6);
    expect(state.jobs).toEqual([]); // job removed after completion
    expect(state.resources).toEqual({ bread: 8, cheese: 4, orange: 9, sandwich: 1 });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][1]).toEqual({ sandwich: 1 });
  });

  it("runs several machines in parallel, one job per machine", () => {
    const ext = makeCrafting();
    const state = makeState();
    expect(ext.start(state, "sandwich", "kitchen-1").kind).toBe("crafting");
    expect(ext.start(state, "sandwich", "kitchen-2").kind).toBe("crafting");
    expect(ext.start(state, "juice", "press-1").kind).toBe("crafting");
    // A busy machine refuses a second job, even for the same recipe.
    expect(ext.start(state, "sandwich", "kitchen-1").kind).toBe("crafting"); // idempotent status
    expect(ext.activeJobs(state)).toHaveLength(3);

    ext.update?.(state, 10);
    expect(state.jobs).toEqual([]);
    expect(state.resources.sandwich).toBe(2);
    expect(state.resources.juice).toBe(1);
    expect(state.resources.pulp).toBe(2);
  });

  it("a large offline dt completes every due job in one pass", () => {
    const ext = makeCrafting();
    const state = makeState();
    ext.start(state, "sandwich", "kitchen-1");
    ext.start(state, "juice", "press-1");

    ext.update?.(state, 60 * 60); // one hour away
    expect(state.jobs).toEqual([]);
    expect(state.resources.sandwich).toBe(1);
    expect(state.resources.juice).toBe(1);
  });

  it("cancel refunds the inputs by default and can skip the refund", () => {
    const ext = makeCrafting();
    const state = makeState();
    ext.start(state, "sandwich", "kitchen-1");

    expect(ext.cancel(state, "kitchen-1")).toBe(true);
    expect(state.jobs).toEqual([]);
    expect(state.resources).toEqual({ bread: 10, cheese: 5, orange: 9 });

    ext.start(state, "sandwich", "kitchen-1");
    expect(ext.cancel(state, "kitchen-1", { refund: false })).toBe(true);
    expect(state.resources).toEqual({ bread: 8, cheese: 4, orange: 9 });

    expect(ext.cancel(state, "kitchen-1")).toBe(false); // idle machine
  });

  it("jobFor and activeJobs expose the running jobs", () => {
    const ext = makeCrafting();
    const state = makeState();
    ext.start(state, "juice", "press-1");
    expect(ext.jobFor(state, "press-1")?.recipeId).toBe("juice");
    expect(ext.jobFor(state, "kitchen-1")).toBeUndefined();
    expect(ext.activeJobs(state)).not.toBe(state.jobs); // snapshot copy
  });
});

describe("crafting save/load", () => {
  /** Wire the extension into a real engine and replay the `loaded` event. */
  function loadedEngine(jobs: CraftingJob[]) {
    const ext = makeCrafting();
    const engine = createEngine<TestState>({ initialState: makeState() });
    engine.use(ext);
    engine.state.jobs = jobs;
    engine.events.emit("loaded", Date.now());
    return { ext, state: engine.state };
  }

  it("resumes a mid-flight job from a saved state", () => {
    const { ext, state } = loadedEngine([
      {
        id: "kitchen-1:sandwich",
        recipeId: "sandwich",
        machineId: "kitchen-1",
        elapsed: 7,
        duration: 10,
      },
    ]);

    ext.update?.(state, 3);
    expect(state.jobs).toEqual([]);
    expect(state.resources.sandwich).toBe(1);
  });

  it("heals a stale save: unknown ids dropped, duration re-derived, elapsed clamped", () => {
    const { state } = loadedEngine([
      { id: "a", recipeId: "removed-recipe", machineId: "kitchen-1", elapsed: 1, duration: 5 },
      { id: "b", recipeId: "sandwich", machineId: "removed-machine", elapsed: 1, duration: 10 },
      { id: "c", recipeId: "sandwich", machineId: "kitchen-1", elapsed: -4, duration: 99 },
      { id: "d", recipeId: "chop", machineId: "kitchen-1", elapsed: 0, duration: 2 }, // duplicate machine
    ]);

    expect(state.jobs).toEqual([
      { id: "c", recipeId: "sandwich", machineId: "kitchen-1", elapsed: 0, duration: 10 },
    ]);
  });
});
