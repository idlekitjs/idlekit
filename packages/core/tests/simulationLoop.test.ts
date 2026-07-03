import { describe, it, expect } from "vitest";
import { SimulationLoop, manualScheduler } from "../src/loop";

/**
 * The loop is headless: it takes an injected `FrameScheduler` and gets its clock
 * from the frame timestamps. We drive it with a `manualScheduler` -- no
 * `requestAnimationFrame`/`performance.now` stubs -- and assert how many
 * fixed-step ticks run for a given real-time budget (the "precision vs speed"
 * heart of the loop).
 *
 * The first frame establishes the time baseline (delta 0), exactly as the first
 * rAF frame does at start time; we push a `frame(0)` baseline before the budget.
 */
function runOneRealSecond(step: number, frames: number): number {
  let ticks = 0;
  const scheduler = manualScheduler();
  const loop = new SimulationLoop({ step, update: () => (ticks += 1), scheduler });
  loop.start();

  scheduler.frame(0); // baseline (delta 0)
  const frameMs = 1000 / frames;
  for (let i = 1; i <= frames; i++) {
    scheduler.frame(i * frameMs);
  }
  loop.stop();
  return ticks;
}

describe("SimulationLoop fixed timestep", () => {
  it("runs at 120 Hz: ~120 ticks per real second, on a 60 Hz display", () => {
    // A 120 Hz simulation rendered on a 60 fps screen: two ticks per frame.
    const ticks = runOneRealSecond(1 / 120, 60);
    expect(ticks).toBe(120);
  });

  it("runs at 120 Hz: ~120 ticks per real second, on a 120 Hz display", () => {
    const ticks = runOneRealSecond(1 / 120, 120);
    expect(ticks).toBe(120);
  });

  it("decouples precision from speed: engine time elapsed is 1x regardless of rate", () => {
    // Whatever the tick rate, the same wall-clock second advances the same
    // amount of simulation time (ticks x step ~= 1 s) -- only the granularity differs.
    const at120 = runOneRealSecond(1 / 120, 60);
    const at60 = runOneRealSecond(1 / 60, 60);
    const at20 = runOneRealSecond(1 / 20, 60);

    // Simulation time elapsed (ticks x step) tracks the real second to within a single
    // tick, whatever the rate -- the rate only changes granularity, not speed.
    expect(Math.abs(at120 * (1 / 120) - 1)).toBeLessThanOrEqual(1 / 120 + 1e-9);
    expect(Math.abs(at60 * (1 / 60) - 1)).toBeLessThanOrEqual(1 / 60 + 1e-9);
    expect(Math.abs(at20 * (1 / 20) - 1)).toBeLessThanOrEqual(1 / 20 + 1e-9);

    // Higher precision = more, finer ticks for the same elapsed time.
    expect(at120).toBeGreaterThan(at60);
    expect(at60).toBeGreaterThan(at20);
  });

  it("caps catch-up per frame to avoid the spiral of death", () => {
    let ticks = 0;
    const scheduler = manualScheduler();
    const loop = new SimulationLoop({
      step: 1 / 120,
      update: () => (ticks += 1),
      maxFrameTime: 0.25,
      scheduler,
    });
    loop.start();

    scheduler.frame(0); // baseline
    // A single huge 10 s frame (e.g. after a stall) is clamped to 0.25 s.
    scheduler.frame(10_000);
    loop.stop();

    expect(ticks).toBe(0.25 * 120); // 30, not 1200
  });

  it("pause() stops processing frames; resume() restarts without a time jump", () => {
    let ticks = 0;
    const scheduler = manualScheduler();
    const loop = new SimulationLoop({ step: 1 / 60, update: () => (ticks += 1), scheduler });
    loop.start();
    scheduler.frame(0);

    loop.pause();
    expect(scheduler.started).toBe(false); // scheduler detached while paused
    scheduler.frame(1000); // ignored: paused (and detached)
    expect(ticks).toBe(0);

    loop.resume();
    expect(scheduler.started).toBe(true);
    scheduler.frame(2000); // baseline after resume: delta 0, no jump for the paused gap
    scheduler.frame(2200); // 0.2 s -> 12 ticks (the 2 s paused gap is NOT credited)
    loop.stop();
    expect(ticks).toBe(12);
  });
});
