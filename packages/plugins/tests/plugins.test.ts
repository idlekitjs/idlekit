import { describe, it, expect } from "vitest";
import { createEngine, SaveManager } from "@idlekitjs/core";
import { MemoryAdapter } from "@idlekitjs/storage/memory";
import type { SaveManager as SaveManagerType } from "@idlekitjs/core";
import { autosave, offlineProgress } from "../src";
import { projects, producers } from "@idlekitjs/mechanics";
import type { Project, ProducerDef, ProducersOptions } from "@idlekitjs/mechanics";

interface State {
  clips: number;
  rate: number;
}

describe("offlineProgress", () => {
  it("advances the simulation on load, capped by maxMs", async () => {
    const adapter = new MemoryAdapter();
    const oneHourAgo = Date.now() - 3_600_000;
    adapter.write(
      "test",
      JSON.stringify({ version: 1, savedAt: oneHourAgo, state: { clips: 0, rate: 2 } }),
    );
    const save = new SaveManager<State>({ key: "test", version: 1, adapter });

    // coarse step: we cap at 10 s, what matters is the total credited.
    const engine = createEngine<State>({ initialState: { clips: 0, rate: 0 }, step: 1 });
    engine.addSystem((state, dt) => {
      state.clips += state.rate * dt;
    });
    engine.use(offlineProgress<State>({ maxMs: 10_000 }));

    await engine.load(save);

    // 1 h offline capped to 10 s => 2 clips/s * 10 s = 20
    expect(engine.state.clips).toBeCloseTo(20, 6);
  });

  it("advances on the resume event", () => {
    const engine = createEngine<State>({ initialState: { clips: 0, rate: 3 }, step: 1 });
    engine.addSystem((state, dt) => {
      state.clips += state.rate * dt;
    });
    engine.use(offlineProgress<State>({ maxMs: 5_000 }));

    engine.events.emit("resume", 5_000);
    expect(engine.state.clips).toBeCloseTo(15, 6);
  });

  it("caps with a finite default when maxMs is not provided", () => {
    const engine = createEngine<State>({ initialState: { clips: 0, rate: 1 }, step: 3_600 });
    engine.addSystem((state, dt) => {
      state.clips += state.rate * dt;
    });
    engine.use(offlineProgress<State>()); // no maxMs

    engine.events.emit("resume", 30 * 24 * 3_600_000); // 30 days

    // Default = 24 h => 86,400 s credited, not 30 days.
    expect(engine.state.clips).toBeCloseTo(86_400, 0);
  });

  it("ignores a negative elapsed time (inconsistent clock)", () => {
    const engine = createEngine<State>({ initialState: { clips: 0, rate: 1 }, step: 1 });
    engine.addSystem((state, dt) => {
      state.clips += state.rate * dt;
    });
    engine.use(offlineProgress<State>({ maxMs: 10_000 }));

    engine.events.emit("resume", -5_000);

    expect(engine.state.clips).toBe(0);
  });
});

describe("autosave (guards)", () => {
  it("throws a clear error if the manager is missing", () => {
    expect(() => autosave({ getState: () => ({}) } as never)).toThrow(/manager/i);
  });

  it("throws a clear error if getState is missing", () => {
    const manager = {} as SaveManagerType<Record<string, unknown>>;
    expect(() => autosave({ manager } as never)).toThrow(/getState/i);
  });
});

interface ProjectState {
  ops: number;
  boost: number;
  completed: string[];
}

function projectFixtures(): Project<ProjectState>[] {
  return [
    {
      id: "p1",
      title: "Boost",
      description: "",
      trigger: () => true,
      affordable: (s) => s.ops >= 100,
      effect: (s) => {
        s.ops -= 100;
        s.boost += 1;
      },
    },
  ];
}

describe("projects", () => {
  it("buys a project and persists progress into the state", () => {
    const engine = createEngine<ProjectState>({
      initialState: { ops: 100, boost: 0, completed: [] },
    });
    const plugin = projects<ProjectState>({
      projects: projectFixtures(),
      getCompleted: (s) => s.completed,
      setCompleted: (s, ids) => {
        s.completed = ids;
      },
    });
    engine.use(plugin);

    expect(plugin.buy("p1", engine.state)).toBe(true);
    expect(engine.state.boost).toBe(1);
    expect(engine.state.completed).toContain("p1");
    expect(plugin.manager.available(engine.state).map((p) => p.id)).not.toContain("p1");
  });

  it("restores progress when a save is loaded", async () => {
    const adapter = new MemoryAdapter();
    adapter.write(
      "proj",
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        state: { ops: 0, boost: 5, completed: ["p1"] },
      }),
    );
    const save = new SaveManager<ProjectState>({ key: "proj", version: 1, adapter });

    const engine = createEngine<ProjectState>({
      initialState: { ops: 0, boost: 0, completed: [] },
    });
    const plugin = projects<ProjectState>({
      projects: projectFixtures(),
      getCompleted: (s) => s.completed,
      setCompleted: (s, ids) => {
        s.completed = ids;
      },
    });
    engine.use(plugin);

    await engine.load(save);

    expect(plugin.manager.isCompleted("p1")).toBe(true);
  });

  it("tolerates a malformed getCompleted on load (falls back to an empty list)", async () => {
    const adapter = new MemoryAdapter();
    adapter.write(
      "proj",
      JSON.stringify({ version: 1, savedAt: Date.now(), state: { ops: 0, boost: 0 } }),
    );
    const save = new SaveManager<ProjectState>({ key: "proj", version: 1, adapter });

    const engine = createEngine<ProjectState>({
      initialState: { ops: 0, boost: 0, completed: [] },
    });
    const plugin = projects<ProjectState>({
      projects: projectFixtures(),
      getCompleted: () => undefined as never, // intentional misuse
      setCompleted: (s, ids) => {
        s.completed = ids;
      },
    });
    engine.use(plugin);

    await expect(engine.load(save)).resolves.toBe(true);
    expect(plugin.manager.isCompleted("p1")).toBe(false);
  });

  it("ignores buying an unknown project", () => {
    const engine = createEngine<ProjectState>({
      initialState: { ops: 100, boost: 0, completed: [] },
    });
    const plugin = projects<ProjectState>({
      projects: projectFixtures(),
      getCompleted: (s) => s.completed,
      setCompleted: (s, ids) => {
        s.completed = ids;
      },
    });
    engine.use(plugin);

    expect(plugin.buy("nonexistent", engine.state)).toBe(false);
  });
});

interface ProducerState {
  resource: number;
  owned: number[];
  total: number[];
  progress: number[];
  running?: boolean[];
  multiplier: number;
}

function producerState(over: Partial<ProducerState> = {}): ProducerState {
  return {
    resource: 0,
    owned: [0, 0],
    total: [0, 0],
    progress: [0, 0],
    multiplier: 1,
    ...over,
  };
}

function producerPlugin(defs: ProducerDef[], extra: Partial<ProducersOptions<ProducerState>> = {}) {
  return producers<ProducerState>({
    definitions: defs,
    getColumn: (s) => ({ owned: s.owned, total: s.total, progress: s.progress, running: s.running }),
    setColumn: (s, patch) => {
      if (patch.owned) s.owned = patch.owned;
      if (patch.total) s.total = patch.total;
      if (patch.progress) s.progress = patch.progress;
      if (patch.running) s.running = patch.running;
    },
    resource: {
      get: (s) => s.resource,
      add: (s, amount) => {
        s.resource += amount;
      },
    },
    getYieldMultiplier: (s) => s.multiplier,
    ...extra,
  });
}

const TWO_TIERS: ProducerDef[] = [
  { id: "t0", cycleTime: 2, yieldPerUnit: 1, baseCost: 10, costGrowth: 1.1 },
  { id: "t1", cycleTime: 5, yieldPerUnit: 3, baseCost: 100, costGrowth: 1.2 },
];

describe("producers", () => {
  it("emits a batch only when a cycle completes (not continuously)", () => {
    const plugin = producerPlugin(TWO_TIERS);
    const state = producerState({ total: [4, 0] });

    plugin.update!(state, 1); // progress 1 < cycleTime 2
    expect(state.resource).toBe(0);

    plugin.update!(state, 1); // progress reaches 2 => one cycle of 4 * 1
    expect(state.resource).toBe(4);
    expect(state.progress[0]).toBeCloseTo(0, 6);
  });

  it("carries the remainder across cycles (rate stays exact)", () => {
    const plugin = producerPlugin([
      { id: "t0", cycleTime: 2, yieldPerUnit: 1, baseCost: 10, costGrowth: 1.1 },
    ]);
    const state = producerState({ owned: [0], total: [1], progress: [0] });

    plugin.update!(state, 3); // 1 cycle (2 s) emitted, 1 s carried over
    expect(state.resource).toBe(1);
    expect(state.progress[0]).toBeCloseTo(1, 6);
  });

  it("cascades: a higher tier produces the tier below, from a tick snapshot", () => {
    const plugin = producerPlugin(TWO_TIERS);
    const state = producerState({ total: [0, 2] });

    plugin.update!(state, 5); // tier 1 completes: 2 units * 3 yield -> tier 0
    expect(state.total[0]).toBe(6);
    expect(state.resource).toBe(0); // tier 0 had 0 units at snapshot time
  });

  it("applies the yield multiplier", () => {
    const plugin = producerPlugin(TWO_TIERS);
    const state = producerState({ total: [4, 0], multiplier: 2.5 });

    plugin.update!(state, 2);
    expect(state.resource).toBe(10); // 1 cycle * 4 units * 1 yield * 2.5 mult
  });

  it("applies the speed multiplier (divides the cycle time)", () => {
    const plugin = producerPlugin(TWO_TIERS, { getSpeedMultiplier: () => 2 });
    const state = producerState({ total: [3, 0] });

    // tier 0 cycleTime 2 / speed 2 => effective 1 s, so dt=1 completes one cycle
    plugin.update!(state, 1);
    expect(state.resource).toBe(3);
  });

  it("stops a tier when its speed multiplier is <= 0", () => {
    const plugin = producerPlugin(TWO_TIERS, { getSpeedMultiplier: () => 0 });
    const state = producerState({ total: [5, 0] });

    plugin.update!(state, 100);
    expect(state.resource).toBe(0);
  });

  it("credits every completed cycle on a large offline dt", () => {
    const plugin = producerPlugin(TWO_TIERS);
    const state = producerState({ total: [1, 0] });

    plugin.update!(state, 21); // floor(21 / 2) = 10 cycles
    expect(state.resource).toBe(10);
    expect(state.progress[0]).toBeCloseTo(1, 6);
  });

  it("purchases a unit: spends the resource and grows owned/total", () => {
    const plugin = producerPlugin(TWO_TIERS);
    const state = producerState({ resource: 50 });

    expect(plugin.purchase(0, state)).toBe(true);
    expect(state.resource).toBe(40); // baseCost 10
    expect(state.owned[0]).toBe(1);
    expect(state.total[0]).toBe(1);

    // next unit costs baseCost * costGrowth^1 = 11
    expect(plugin.cost(0, state)).toBeCloseTo(11, 6);
  });

  it("prices bulk purchases with the geometric series", () => {
    const plugin = producerPlugin(TWO_TIERS);
    const state = producerState();

    expect(plugin.costFor(0, state, 3)).toBeCloseTo(10 + 11 + 12.1, 9);
    expect(plugin.costFor(0, state, 0)).toBe(0);
    expect(plugin.costFor(9, state, 3)).toBe(Infinity);
  });

  it("computes the maximum affordable quantity with the inverse geometric series", () => {
    const plugin = producerPlugin(TWO_TIERS);
    const state = producerState();

    expect(plugin.maxAffordable(0, state, 46.41)).toBe(4);
    expect(plugin.maxAffordable(0, state, 46.4)).toBe(3);
    expect(plugin.maxAffordable(0, state, 9)).toBe(0);
  });

  it("buys many units and reports the transaction", () => {
    const plugin = producerPlugin(TWO_TIERS);
    const state = producerState({ resource: 50 });

    const result = plugin.purchaseMany(0, state, 10);

    expect(result.bought).toBe(4);
    expect(result.spent).toBeCloseTo(46.41, 9);
    expect(result.remaining).toBeCloseTo(3.59, 9);
    expect(state.owned[0]).toBe(4);
    expect(state.total[0]).toBe(4);
  });

  it("buys with a budget slice instead of the whole resource", () => {
    const plugin = producerPlugin(TWO_TIERS);
    const state = producerState({ resource: 1_000 });

    const result = plugin.purchaseWithBudget(0, state, 50);

    expect(result.bought).toBe(4);
    expect(result.spent).toBeCloseTo(46.41, 9);
    expect(result.remaining).toBeCloseTo(953.59, 9);
    expect(state.owned[0]).toBe(4);
  });

  it("starts a bulk-activated tier's cycle from zero", () => {
    const plugin = producerPlugin(TWO_TIERS);
    const state = producerState({ resource: 50, total: [0, 0], progress: [1.9, 0] });

    expect(plugin.purchaseMany(0, state, 2).bought).toBe(2);
    expect(state.progress[0]).toBe(0);
  });

  it("refuses a purchase when the resource is insufficient", () => {
    const plugin = producerPlugin(TWO_TIERS);
    const state = producerState({ resource: 5 });

    expect(plugin.purchase(0, state)).toBe(false);
    expect(state.owned[0]).toBe(0);
    expect(state.resource).toBe(5);
  });

  it("ignores an out-of-range index", () => {
    const plugin = producerPlugin(TWO_TIERS);
    const state = producerState({ resource: 1_000 });

    expect(plugin.purchase(9, state)).toBe(false);
    expect(plugin.cost(9, state)).toBe(Infinity);
  });

  it("reports the average rate per second for display", () => {
    const plugin = producerPlugin(TWO_TIERS);
    const state = producerState({ total: [6, 0], multiplier: 2 });

    // 6 units * 1 yield * 2 mult / 2 s = 6 / s
    expect(plugin.ratePerSecond(state, 0)).toBeCloseTo(6, 6);
  });

  it("reports the cycle progress as a clamped [0, 1] fraction", () => {
    const plugin = producerPlugin(TWO_TIERS);
    const state = producerState({ total: [1, 0], progress: [1, 0] }); // tier 0 cycleTime 2

    expect(plugin.progressFraction(state, 0)).toBeCloseTo(0.5, 6);

    state.progress = [3, 0]; // beyond a full cycle -> clamped to 1
    expect(plugin.progressFraction(state, 0)).toBe(1);
  });

  it("scales the progress fraction by the speed multiplier", () => {
    const plugin = producerPlugin(TWO_TIERS, { getSpeedMultiplier: () => 2 });
    const state = producerState({ total: [1, 0], progress: [1, 0] }); // effective cycle 2/2 = 1 s

    expect(plugin.progressFraction(state, 0)).toBe(1);
  });

  it("reports zero progress for a stopped tier", () => {
    const plugin = producerPlugin(TWO_TIERS, { getSpeedMultiplier: () => 0 });
    const state = producerState({ total: [1, 0], progress: [1, 0] });

    expect(plugin.progressFraction(state, 0)).toBe(0);
  });

  it("reports zero progress and no production for an empty tier (no units)", () => {
    const plugin = producerPlugin(TWO_TIERS);
    const state = producerState({ total: [0, 0] });

    plugin.update!(state, 100);
    expect(state.resource).toBe(0);
    expect(state.progress[0]).toBe(0); // no banked time while empty
    expect(plugin.progressFraction(state, 0)).toBe(0);
    expect(plugin.effectiveCycleTime(state, 0)).toBe(Infinity);
  });

  it("heals banked progress on an empty tier (legacy saves)", () => {
    const plugin = producerPlugin(TWO_TIERS);
    const state = producerState({ total: [0, 0], progress: [1.9, 0] });

    plugin.update!(state, 0.01); // a tick clears the stale banked time
    expect(state.progress[0]).toBe(0);
    expect(state.resource).toBe(0);
  });

  it("starts the first unit's cycle from zero, ignoring banked time", () => {
    const plugin = producerPlugin(TWO_TIERS);
    const state = producerState({ resource: 50, total: [0, 0], progress: [1.9, 0] });

    expect(plugin.purchase(0, state)).toBe(true);
    expect(state.progress[0]).toBe(0); // fresh cycle, not nearly-complete

    plugin.update!(state, 1); // cycleTime 2 -> half a cycle, nothing emitted yet
    expect(state.resource).toBe(40); // only the purchase cost was spent
    expect(plugin.progressFraction(state, 0)).toBeCloseTo(0.5, 6);
  });

  it("reports the speed-adjusted effective cycle time (Infinity when stopped)", () => {
    const plugin = producerPlugin(TWO_TIERS);
    const state = producerState({ total: [1, 0] });
    expect(plugin.effectiveCycleTime(state, 0)).toBeCloseTo(2, 6); // cycleTime 2 / speed 1

    const faster = producerPlugin(TWO_TIERS, { getSpeedMultiplier: () => 4 });
    expect(faster.effectiveCycleTime(state, 0)).toBeCloseTo(0.5, 6); // 2 / 4

    const stopped = producerPlugin(TWO_TIERS, { getSpeedMultiplier: () => 0 });
    expect(stopped.effectiveCycleTime(state, 0)).toBe(Infinity);
  });
});

describe("producers: purchase seam", () => {
  interface SeamState extends ProducerState {
    /** One independent scalar budget per tier — the mechanic never sees which. */
    wallets: number[];
  }

  function seamState(over: Partial<SeamState> = {}): SeamState {
    return { ...producerState(), wallets: [0, 0], ...over };
  }

  function seamPlugin(extra: Partial<ProducersOptions<SeamState>> = {}) {
    return producers<SeamState>({
      definitions: TWO_TIERS,
      getColumn: (s) => ({ owned: s.owned, total: s.total, progress: s.progress }),
      setColumn: (s, patch) => {
        if (patch.owned) s.owned = patch.owned;
        if (patch.total) s.total = patch.total;
        if (patch.progress) s.progress = patch.progress;
      },
      resource: {
        get: (s) => s.resource,
        add: (s, amount) => {
          s.resource += amount;
        },
      },
      purchase: {
        getBudget: (s, index) => s.wallets[index] ?? 0,
        pay: (s, index, amount) => {
          s.wallets[index] -= amount;
        },
      },
      ...extra,
    });
  }

  it("routes maxAffordable through getBudget when no explicit budget is given", () => {
    const plugin = seamPlugin();
    const state = seamState({ resource: 1_000_000, wallets: [46.41, 0] });

    // The huge `resource` is irrelevant: only the tier's wallet counts.
    expect(plugin.maxAffordable(0, state)).toBe(4);
    expect(plugin.maxAffordable(1, state)).toBe(0);
  });

  it("debits via pay and leaves the main resource untouched", () => {
    const plugin = seamPlugin();
    const state = seamState({ resource: 5, wallets: [50, 0] });

    expect(plugin.purchase(0, state)).toBe(true);
    expect(state.wallets[0]).toBe(40); // baseCost 10 taken from the wallet
    expect(state.resource).toBe(5); // never touched
    expect(state.owned[0]).toBe(1);
  });

  it("keeps the geometric pricing identical through the seam", () => {
    const plugin = seamPlugin();
    const state = seamState({ wallets: [1_000, 0] });

    const result = plugin.purchaseMany(0, state, 3);
    expect(result.bought).toBe(3);
    expect(result.spent).toBeCloseTo(10 + 11 + 12.1, 9);
    expect(result.remaining).toBeCloseTo(1_000 - 33.1, 9);
  });

  it("refuses a purchase when the custom budget is insufficient", () => {
    const plugin = seamPlugin();
    const state = seamState({ resource: 1_000_000, wallets: [9, 0] });

    expect(plugin.purchase(0, state)).toBe(false);
    expect(state.wallets[0]).toBe(9);
    expect(state.owned[0]).toBe(0);
  });

  it("keeps purchaseWithBudget consistent: explicit slice, paid through the seam", () => {
    const plugin = seamPlugin();
    const state = seamState({ wallets: [1_000, 0] });

    const result = plugin.purchaseWithBudget(0, state, 50);
    expect(result.bought).toBe(4);
    expect(result.spent).toBeCloseTo(46.41, 9);
    expect(state.wallets[0]).toBeCloseTo(1_000 - 46.41, 9);
    expect(result.remaining).toBeCloseTo(1_000 - 46.41, 9); // remaining = tier budget
  });

  it("supports a different currency per tier without producers knowing which", () => {
    const plugin = seamPlugin();
    const state = seamState({ wallets: [0, 500] });

    expect(plugin.purchase(0, state)).toBe(false); // tier 0 wallet is empty
    expect(plugin.purchase(1, state)).toBe(true); // tier 1 wallet pays its own cost
    expect(state.wallets[1]).toBe(400); // baseCost 100
    expect(state.owned[1]).toBe(1);
  });

  it("still spends the main resource when no seam is configured (non-regression)", () => {
    const plugin = producerPlugin(TWO_TIERS);
    const state = producerState({ resource: 50 });

    expect(plugin.purchase(0, state)).toBe(true);
    expect(state.resource).toBe(40);
    expect(plugin.maxAffordable(0, state)).toBe(3); // 40 buys the next 11 + 12.1 + ...
  });
});

describe("producers: manual cycles", () => {
  const manualTier0 = { getIsAutomated: (_s: ProducerState, index: number) => index !== 1 };
  const allManual = { getIsAutomated: () => false };

  it("does not advance a manual tier until run() is called", () => {
    const plugin = producerPlugin(TWO_TIERS, allManual);
    const state = producerState({ total: [4, 0] });

    plugin.update!(state, 100);
    expect(state.resource).toBe(0);
    expect(state.progress[0]).toBe(0); // idle: banks no time
  });

  it("run() arms one cycle and the tier starts progressing", () => {
    const plugin = producerPlugin(TWO_TIERS, allManual);
    const state = producerState({ total: [4, 0] });

    expect(plugin.run(0, state)).toBe(true);
    expect(plugin.isRunning(state, 0)).toBe(true);

    plugin.update!(state, 1); // half of cycleTime 2
    expect(plugin.progressFraction(state, 0)).toBeCloseTo(0.5, 6);
    expect(state.resource).toBe(0);
  });

  it("run() refuses an empty tier, an invalid index and an automated tier", () => {
    const plugin = producerPlugin(TWO_TIERS, manualTier0);
    const state = producerState({ total: [3, 0] });

    expect(plugin.run(0, state)).toBe(false); // tier 0 is automated here
    expect(plugin.run(1, state)).toBe(false); // tier 1 is manual but empty
    expect(plugin.run(9, state)).toBe(false); // out of range
  });

  it("run() refuses a second call while a cycle is in flight", () => {
    const plugin = producerPlugin(TWO_TIERS, allManual);
    const state = producerState({ total: [4, 0] });

    expect(plugin.run(0, state)).toBe(true);
    expect(plugin.run(0, state)).toBe(false);
  });

  it("credits the production and rearms on completion of a manual cycle", () => {
    const plugin = producerPlugin(TWO_TIERS, allManual);
    const state = producerState({ total: [4, 0] });

    plugin.run(0, state);
    plugin.update!(state, 2); // exactly one cycleTime

    expect(state.resource).toBe(4);
    expect(state.progress[0]).toBe(0);
    expect(plugin.isRunning(state, 0)).toBe(false); // back to idle
    expect(plugin.run(0, state)).toBe(true); // can be started again
  });

  it("completes a single manual cycle on a huge dt and discards the excess", () => {
    const plugin = producerPlugin(TWO_TIERS, allManual);
    const state = producerState({ total: [1, 0] });

    plugin.run(0, state);
    plugin.update!(state, 1_000); // would be 500 automated cycles

    expect(state.resource).toBe(1); // exactly one cycle credited
    expect(state.progress[0]).toBe(0);
    expect(plugin.isRunning(state, 0)).toBe(false);
  });

  it("runs automatically by default (non-regression without getIsAutomated)", () => {
    const plugin = producerPlugin(TWO_TIERS);
    const state = producerState({ total: [1, 0] });

    plugin.update!(state, 21);
    expect(state.resource).toBe(10); // 10 automatic cycles, as before
    expect(plugin.isRunning(state, 0)).toBe(true); // automated + units => running
  });

  it("auto-runs a tier whose getIsAutomated flips to true mid-cycle", () => {
    let automated = false;
    const plugin = producerPlugin(TWO_TIERS, { getIsAutomated: () => automated });
    const state = producerState({ total: [1, 0] });

    plugin.run(0, state);
    plugin.update!(state, 1); // manual: half a cycle banked

    automated = true; // automation acquired: the running flag is ignored
    plugin.update!(state, 5); // (1 + 5) / 2 => 3 full automatic cycles
    expect(state.resource).toBe(3);
  });

  it("freezes a running manual cycle while speed <= 0, without losing progress", () => {
    let speed = 1;
    const plugin = producerPlugin(TWO_TIERS, {
      ...allManual,
      getSpeedMultiplier: () => speed,
    });
    const state = producerState({ total: [2, 0] });

    plugin.run(0, state);
    plugin.update!(state, 1); // half a cycle

    speed = 0; // paused: progress is kept, nothing advances
    plugin.update!(state, 100);
    expect(state.resource).toBe(0);
    expect(state.progress[0]).toBeCloseTo(1, 6);

    speed = 1; // resumed: the armed cycle finishes
    plugin.update!(state, 1);
    expect(state.resource).toBe(2);
  });

  it("clears a stale running flag when the tier empties", () => {
    const plugin = producerPlugin(TWO_TIERS, allManual);
    const state = producerState({ total: [1, 0] });

    plugin.run(0, state);
    state.total = [0, 0]; // e.g. consumed by another mechanic

    plugin.update!(state, 100);
    expect(state.resource).toBe(0);
    expect(state.running?.[0]).toBe(false); // flag healed, no ghost auto-start
    expect(plugin.isRunning(state, 0)).toBe(false);
  });

  it("isRunning() reflects automation, units and the manual flag", () => {
    const plugin = producerPlugin(TWO_TIERS, manualTier0);
    const state = producerState({ total: [1, 1] });

    expect(plugin.isRunning(state, 0)).toBe(true); // automated with units
    expect(plugin.isRunning(state, 1)).toBe(false); // manual, not started
    expect(plugin.isRunning(state, 9)).toBe(false); // out of range

    plugin.run(1, state);
    expect(plugin.isRunning(state, 1)).toBe(true);
  });

  it("keeps working with a save that has no running array (compat)", () => {
    const plugin = producerPlugin(TWO_TIERS, allManual);
    const state = producerState({ total: [4, 0] }); // running is undefined

    plugin.update!(state, 100); // no crash, no progress
    expect(state.resource).toBe(0);
    expect(plugin.run(0, state)).toBe(true); // arming materializes the array
    expect(state.running).toEqual([true, false]);
  });
});
