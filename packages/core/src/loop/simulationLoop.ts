import type { FrameScheduler } from "./scheduler";
import { manualScheduler } from "./scheduler";

/**
 * Simulation loop with a fixed time step (the classic game-loop pattern), driven
 * by an injected {@link FrameScheduler}.
 *
 * - `update(dt)` is called at a fixed interval (`step`), independent of the frame
 *   rate: the simulation stays deterministic.
 * - `render()` is called once per driver frame, after the updates.
 * - The frame clock (`now`) comes from the scheduler, so the loop itself never
 *   touches `requestAnimationFrame` or `performance.now` — `@idlekitjs/core` stays
 *   headless. The browser driver lives in `@idlekitjs/browser` (`createRafScheduler`).
 * - Background pause/resume (and offline elapsed) is not handled here: it is an
 *   opt-in concern owned by `@idlekitjs/browser/page-lifecycle`, which drives
 *   `pause()`/`resume()`.
 */
export interface SimulationLoopOptions {
  /** Simulation update, `dt` in seconds (= `step`). */
  update: (dt: number) => void;
  /** Render, called once per frame after the updates. */
  render?: () => void;
  /** Fixed time step in seconds. Default: 1/20 s (20 Hz). */
  step?: number;
  /** Max catch-up per frame in seconds, to avoid the spiral of death. */
  maxFrameTime?: number;
  /** Frame driver. Defaults to a headless {@link manualScheduler}. */
  scheduler?: FrameScheduler;
}

export class SimulationLoop {
  private readonly update: (dt: number) => void;
  private readonly renderFrame?: () => void;
  private readonly step: number;
  private readonly maxFrameTime: number;
  private readonly scheduler: FrameScheduler;
  private running = false;
  private paused = false;
  /** `null` until the first frame after a (re)start, to make its delta 0. */
  private lastFrame: number | null = null;
  private accumulator = 0;

  private readonly boundFrame = (now: number) => this.frame(now);

  constructor(options: SimulationLoopOptions) {
    this.update = options.update;
    this.renderFrame = options.render;
    this.step = options.step ?? 1 / 20;
    this.maxFrameTime = options.maxFrameTime ?? 0.25;
    this.scheduler = options.scheduler ?? manualScheduler();
  }

  get isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.paused = false;
    this.accumulator = 0;
    this.lastFrame = null;
    this.scheduler.start(this.boundFrame);
  }

  stop(): void {
    this.running = false;
    this.paused = false;
    this.scheduler.stop();
  }

  /** Suspend frame processing without ending the run (e.g. tab hidden). */
  pause(): void {
    if (!this.running || this.paused) {
      return;
    }
    this.paused = true;
    this.scheduler.stop();
  }

  /** Resume after a {@link pause}. The next frame's delta is 0 (no time jump). */
  resume(): void {
    if (!this.running || !this.paused) {
      return;
    }
    this.paused = false;
    this.lastFrame = null;
    this.scheduler.start(this.boundFrame);
  }

  private frame(now: number): void {
    if (!this.running || this.paused) {
      return;
    }
    if (this.lastFrame === null) {
      this.lastFrame = now;
    }
    let delta = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    if (delta > this.maxFrameTime) {
      delta = this.maxFrameTime;
    }
    this.accumulator += delta;
    while (this.accumulator >= this.step) {
      this.update(this.step);
      this.accumulator -= this.step;
    }
    this.renderFrame?.();
  }
}
