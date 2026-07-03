import { FrameRateMeter } from "@idlekitjs/utils";

/** Window over which the simulation tick rate is averaged (ms). */
const TICK_WINDOW_MS = 500;

/**
 * Runtime metrics for the debug overlay: smoothed render frame rate and the
 * measured simulation tick rate. Fed from the plugin's `update` (one tick) and
 * `render` (one frame) hooks; kept pure and DOM-free so it is unit-testable.
 */
export class DevMetrics {
  private readonly meter = new FrameRateMeter();
  private windowStartMs = 0;
  private windowTicks = 0;
  private started = false;
  private tickRateValue = 0;
  private totalTicksValue = 0;

  /** Record one simulation tick (called from the plugin's `update`). */
  recordTick(): void {
    this.totalTicksValue += 1;
    this.windowTicks += 1;
  }

  /** Record one rendered frame at timestamp `nowMs` (from the plugin's `render`). */
  recordFrame(nowMs: number): void {
    this.meter.sample(nowMs);
    if (!this.started) {
      this.started = true;
      this.windowStartMs = nowMs;
      return;
    }
    const elapsed = nowMs - this.windowStartMs;
    if (elapsed >= TICK_WINDOW_MS) {
      this.tickRateValue = (this.windowTicks * 1000) / elapsed;
      this.windowTicks = 0;
      this.windowStartMs = nowMs;
    }
  }

  /** Smoothed render frame rate (frames per second). */
  get fps(): number {
    return this.meter.value;
  }

  /** Measured simulation rate (ticks per second). */
  get tickRate(): number {
    return this.tickRateValue;
  }

  /** Total ticks since start. */
  get totalTicks(): number {
    return this.totalTicksValue;
  }
}
