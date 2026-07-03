import { clamp } from "./num";

/**
 * Measures the real frame rate from frame timestamps, smoothed with an
 * exponential moving average so it does not jitter frame to frame.
 *
 * Framework-agnostic: feed it `performance.now()` (or any monotonic ms clock)
 * once per frame and read `value`. Used to make frame-dependent decisions
 * adaptive instead of assuming 60 Hz -- e.g. "this cycle is too short to show as
 * a bar" depends on how many frames it actually spans on this display.
 */
export class FrameRateMeter {
  private lastMs = 0;
  private started = false;
  private fps: number;

  /**
   * @param initialFps Value reported before the first interval is measured.
   * @param smoothing  EMA factor in `(0, 1]`: higher reacts faster, lower is steadier.
   */
  constructor(
    initialFps = 60,
    private readonly smoothing = 0.1,
  ) {
    this.fps = initialFps;
  }

  /** Feed a frame timestamp (ms). Returns the current smoothed frame rate. */
  sample(nowMs: number): number {
    if (this.started) {
      const dt = nowMs - this.lastMs;
      if (dt > 0) {
        // Clamp the instantaneous reading so a stall (e.g. backgrounded tab)
        // cannot throw the average to an absurd value.
        const instant = clamp(1000 / dt, 1, 1000);
        this.fps += (instant - this.fps) * this.smoothing;
      }
    }
    this.lastMs = nowMs;
    this.started = true;
    return this.fps;
  }

  /** Current smoothed frame rate (frames per second). */
  get value(): number {
    return this.fps;
  }

  /** Reset the measurement (e.g. after a long pause). */
  reset(initialFps = 60): void {
    this.fps = initialFps;
    this.started = false;
    this.lastMs = 0;
  }
}
