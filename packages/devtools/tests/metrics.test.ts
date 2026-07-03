import { describe, it, expect } from "vitest";
import { DevMetrics } from "../src/metrics";

describe("DevMetrics", () => {
  it("counts total ticks", () => {
    const metrics = new DevMetrics();
    metrics.recordTick();
    metrics.recordTick();
    metrics.recordTick();
    expect(metrics.totalTicks).toBe(3);
  });

  it("computes the tick rate over a measurement window", () => {
    const metrics = new DevMetrics();
    metrics.recordFrame(0); // opens the window
    for (let i = 0; i < 120; i++) {
      metrics.recordTick();
    }
    metrics.recordFrame(1000); // 1 s elapsed -> 120 ticks/s
    expect(metrics.tickRate).toBe(120);
    expect(metrics.totalTicks).toBe(120);
  });

  it("keeps the tick rate at 0 until the window elapses", () => {
    const metrics = new DevMetrics();
    metrics.recordFrame(0);
    metrics.recordTick();
    metrics.recordFrame(100); // < 500 ms window
    expect(metrics.tickRate).toBe(0);
  });

  it("tracks a frame rate once frames are recorded", () => {
    const metrics = new DevMetrics();
    metrics.recordFrame(0);
    metrics.recordFrame(1000 / 60);
    expect(metrics.fps).toBeGreaterThan(0);
  });
});
