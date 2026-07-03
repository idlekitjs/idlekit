import { describe, it, expect } from "vitest";
import { FrameRateMeter } from "../src";

describe("FrameRateMeter", () => {
  it("reports the initial value before any interval is measured", () => {
    const meter = new FrameRateMeter(60);
    expect(meter.sample(0)).toBe(60); // first sample has no previous frame
    expect(meter.value).toBe(60);
  });

  it("converges toward the real rate from steady frame timestamps", () => {
    const meter = new FrameRateMeter(60, 0.2);
    let now = 0;
    for (let i = 0; i < 200; i++) {
      now += 1000 / 120; // a steady 120 Hz cadence
      meter.sample(now);
    }
    expect(meter.value).toBeCloseTo(120, 1);
  });

  it("smooths toward a lower rate without snapping", () => {
    const meter = new FrameRateMeter(60, 0.1);
    // One slow 100 ms frame (10 fps): the EMA dips, but only by ~10%.
    meter.sample(0);
    meter.sample(100);
    expect(meter.value).toBeLessThan(60);
    expect(meter.value).toBeGreaterThan(50);
  });

  it("clamps an extreme interval (a stall) instead of collapsing", () => {
    const meter = new FrameRateMeter(60, 1); // no smoothing: take the instant value
    meter.sample(0);
    meter.sample(60_000); // 60 s frame -> 1/60 fps, clamped to a floor of 1
    expect(meter.value).toBe(1);
  });

  it("resets the measurement", () => {
    const meter = new FrameRateMeter(60);
    meter.sample(0);
    meter.sample(8);
    meter.reset(30);
    expect(meter.value).toBe(30);
    expect(meter.sample(0)).toBe(30); // treated as a fresh first frame
  });
});
