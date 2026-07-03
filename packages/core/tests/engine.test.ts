import { describe, it, expect } from "vitest";
import { createEngine } from "../src/engine";

interface TestState {
  clips: number;
  rate: number;
}

describe("Engine.advance", () => {
  it("advances in fixed steps and sums correctly (linear system)", () => {
    const engine = createEngine<TestState>({ initialState: { clips: 0, rate: 2 }, step: 0.05 });
    engine.addSystem((state, dt) => {
      state.clips += state.rate * dt;
    });

    engine.advance(10);

    expect(engine.state.clips).toBeCloseTo(20, 6);
  });

  it("splits the duration into `step`-sized steps, never larger than the step", () => {
    const dts: number[] = [];
    const engine = createEngine<TestState>({ initialState: { clips: 0, rate: 0 }, step: 0.1 });
    engine.addSystem((_state, dt) => {
      dts.push(dt);
    });

    engine.advance(1);

    expect(dts.length).toBe(10);
    expect(Math.max(...dts)).toBeLessThanOrEqual(0.1 + 1e-9);
  });

  it("applies a final partial step for the remaining duration", () => {
    const dts: number[] = [];
    const engine = createEngine<TestState>({ initialState: { clips: 0, rate: 0 }, step: 0.1 });
    engine.addSystem((_state, dt) => {
      dts.push(dt);
    });

    engine.advance(0.25);

    expect(dts.length).toBe(3);
    expect(dts[0]).toBeCloseTo(0.1, 9);
    expect(dts[2]).toBeCloseTo(0.05, 9);
  });

  it("crosses a non-linear threshold at the right time (vs a single pass)", () => {
    interface ThresholdState {
      elapsed: number;
      crossedAt: number;
    }
    const engine = createEngine<ThresholdState>({
      initialState: { elapsed: 0, crossedAt: 0 },
      step: 1,
    });
    engine.addSystem((state, dt) => {
      state.elapsed += dt;
      if (state.elapsed >= 3 && state.crossedAt === 0) {
        state.crossedAt = state.elapsed;
      }
    });

    engine.advance(10);

    // A single pass would give crossedAt = 10; in steps of 1, the threshold is
    // detected as soon as the accumulator reaches 3.
    expect(engine.state.crossedAt).toBe(3);
  });

  it("ignores zero or negative durations", () => {
    const engine = createEngine<TestState>({ initialState: { clips: 5, rate: 1 } });
    engine.addSystem((state, dt) => {
      state.clips += state.rate * dt;
    });

    engine.advance(0);
    engine.advance(-3);

    expect(engine.state.clips).toBe(5);
  });

  it("applies every registered system on each step", () => {
    const engine = createEngine<TestState>({ initialState: { clips: 0, rate: 1 }, step: 0.05 });
    engine.addSystem((state, dt) => {
      state.clips += state.rate * dt;
    });
    engine.addSystem((state, dt) => {
      state.clips += dt;
    });

    engine.advance(5);

    expect(engine.state.clips).toBeCloseTo(10, 6);
  });
});
