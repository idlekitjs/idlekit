import { describe, expect, it, vi } from "vitest";
import { timers } from "../src/timers";
import type { TimersData, TimersExtension } from "../src/timers";

interface TestState {
  timers: TimersData;
}

function createState(): TestState {
  return { timers: {} };
}

function createExtension(
  onFire?: (id: string, state: TestState, fires: number) => void,
): TimersExtension<TestState> {
  return timers<TestState>({
    definitions: [
      { id: "truck", every: 10 },
      { id: "patrol", every: 5, autoStart: false },
    ],
    getData: (state) => state.timers,
    setData: (state, data) => {
      state.timers = data;
    },
    onFire,
  });
}

describe("wiring validation", () => {
  it("throws on duplicate ids and invalid periods", () => {
    const wire = (definitions: { id: string; every: number }[]): void => {
      timers<TestState>({
        definitions,
        getData: (state) => state.timers,
        setData: () => {},
      });
    };
    expect(() =>
      wire([
        { id: "a", every: 1 },
        { id: "a", every: 2 },
      ]),
    ).toThrow(/duplicate timer id/);
    expect(() => wire([{ id: "a", every: 0 }])).toThrow(/every/);
    expect(() => wire([{ id: "a", every: NaN }])).toThrow(/every/);
  });
});

describe("running state", () => {
  it("autoStart defaults to true, autoStart false stays stopped", () => {
    const plugin = createExtension();
    const state = createState();
    expect(plugin.isRunning(state, "truck")).toBe(true);
    expect(plugin.isRunning(state, "patrol")).toBe(false);
  });

  it("start resumes and stop pauses, keeping progress", () => {
    const fired = vi.fn();
    const plugin = createExtension(fired);
    const state = createState();

    plugin.update?.(state, 6); // truck at 6/10
    expect(plugin.stop(state, "truck")).toBe(true);
    plugin.update?.(state, 100); // frozen while stopped
    expect(fired).not.toHaveBeenCalled();
    expect(plugin.progressFraction(state, "truck")).toBeCloseTo(0.6, 10);

    expect(plugin.start(state, "truck")).toBe(true);
    plugin.update?.(state, 4);
    expect(fired).toHaveBeenCalledWith("truck", state, 1);
  });

  it("returns false for unknown timers", () => {
    const plugin = createExtension();
    const state = createState();
    expect(plugin.start(state, "nope")).toBe(false);
    expect(plugin.stop(state, "nope")).toBe(false);
    expect(plugin.trigger(state, "nope")).toBe(false);
    expect(plugin.isRunning(state, "nope")).toBe(false);
    expect(plugin.progressFraction(state, "nope")).toBe(0);
  });
});

describe("firing", () => {
  it("fires once when the period elapses and resets the countdown", () => {
    const fired = vi.fn();
    const plugin = createExtension(fired);
    const state = createState();

    plugin.update?.(state, 9.5);
    expect(fired).not.toHaveBeenCalled();
    plugin.update?.(state, 0.5);
    expect(fired).toHaveBeenCalledTimes(1);
    expect(fired).toHaveBeenCalledWith("truck", state, 1);
    expect(plugin.progressFraction(state, "truck")).toBe(0);
  });

  it("reports several fires for a large offline dt", () => {
    const fired = vi.fn();
    const plugin = createExtension(fired);
    const state = createState();

    plugin.update?.(state, 47); // 4 full periods, 7s into the next
    expect(fired).toHaveBeenCalledTimes(1);
    expect(fired).toHaveBeenCalledWith("truck", state, 4);
    expect(plugin.progressFraction(state, "truck")).toBeCloseTo(0.7, 10);
  });

  it("stopped timers never fire", () => {
    const fired = vi.fn();
    const plugin = createExtension(fired);
    const state = createState();
    plugin.update?.(state, 1000);
    expect(fired).toHaveBeenCalledTimes(1); // truck only
    expect(fired.mock.calls.every(([id]) => id === "truck")).toBe(true);
  });

  it("trigger fires manually and resets the period, running or not", () => {
    const fired = vi.fn();
    const plugin = createExtension(fired);
    const state = createState();

    plugin.update?.(state, 6);
    expect(plugin.trigger(state, "truck")).toBe(true);
    expect(fired).toHaveBeenCalledWith("truck", state, 1);
    expect(plugin.progressFraction(state, "truck")).toBe(0);

    expect(plugin.trigger(state, "patrol")).toBe(true); // stopped, still fires
    expect(fired).toHaveBeenCalledWith("patrol", state, 1);
  });
});

describe("state materialization", () => {
  it("materializes missing entries on the first update (fresh save)", () => {
    const plugin = createExtension();
    const state = createState();
    expect(state.timers).toEqual({});
    plugin.update?.(state, 0.1);
    expect(state.timers.truck).toEqual({ remaining: 9.9, running: true });
    expect(state.timers.patrol).toEqual({ remaining: 5, running: false });
  });
});
