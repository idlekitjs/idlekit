import { describe, it, expect } from "vitest";
import { createEngine, manualScheduler } from "../src";

/**
 * Proves `@idlekitjs/core` runs headless: a real `Engine` driven by `manualScheduler`
 * with NO browser globals and NO stubs (`requestAnimationFrame`, `document`,
 * `window`, `performance` are never touched). If core regained a browser
 * dependency, this would throw in Node.
 */
interface State {
  seconds: number;
}

describe("headless core", () => {
  it("runs a system via the loop with a manual scheduler (no browser globals)", () => {
    const scheduler = manualScheduler();
    const engine = createEngine<State>({ initialState: { seconds: 0 }, scheduler });
    engine.addSystem((state, dt) => {
      state.seconds += dt;
    });

    engine.start();
    scheduler.frame(0); // baseline (delta 0)
    // Drive 1 s in 100 ms frames (each below the 0.25 s spiral-of-death clamp).
    for (let ms = 100; ms <= 1000; ms += 100) {
      scheduler.frame(ms);
    }

    expect(engine.state.seconds).toBeCloseTo(1, 6);
  });

  it("advance() steps the simulation without any driver", () => {
    const engine = createEngine<State>({ initialState: { seconds: 0 } });
    engine.addSystem((state, dt) => {
      state.seconds += dt;
    });

    engine.advance(2); // 2 s of offline catch-up, headless

    expect(engine.state.seconds).toBeCloseTo(2, 6);
  });

  it("pause() freezes the loop and resume() restarts it, headless", () => {
    const scheduler = manualScheduler();
    const engine = createEngine<State>({ initialState: { seconds: 0 }, scheduler });
    engine.addSystem((state, dt) => {
      state.seconds += dt;
    });

    engine.start();
    scheduler.frame(0); // baseline

    engine.pause();
    scheduler.frame(5000); // ignored while paused
    expect(engine.state.seconds).toBe(0);

    engine.resume();
    scheduler.frame(6000); // baseline after resume (delta 0), the paused gap is not credited
    scheduler.frame(6200); // +0.2 s
    expect(engine.state.seconds).toBeCloseTo(0.2, 6);
  });
});
