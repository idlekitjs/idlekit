import { describe, it, expect, vi, afterEach } from "vitest";
import { createRafScheduler } from "../src/raf-scheduler";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createRafScheduler", () => {
  it("drives frames via requestAnimationFrame and re-arms after each frame", () => {
    const driver: { cb: ((now: number) => void) | null } = { cb: null };
    let armed = 0;
    vi.stubGlobal("requestAnimationFrame", (fn: (now: number) => void) => {
      driver.cb = fn;
      return ++armed;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});

    const frames: number[] = [];
    const scheduler = createRafScheduler();
    scheduler.start((now) => frames.push(now));

    expect(armed).toBe(1); // one frame armed on start
    driver.cb?.(16);
    driver.cb?.(32);
    expect(frames).toEqual([16, 32]);
    expect(armed).toBe(3); // re-armed after each delivered frame
  });

  it("cancels the pending frame on stop", () => {
    let armed = 0;
    const cancelled: number[] = [];
    vi.stubGlobal("requestAnimationFrame", () => ++armed);
    vi.stubGlobal("cancelAnimationFrame", (id: number) => cancelled.push(id));

    const scheduler = createRafScheduler();
    scheduler.start(() => {});
    scheduler.stop();

    expect(cancelled).toContain(1);
  });
});
