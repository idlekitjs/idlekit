/**
 * Frame scheduling boundary. Keeps `@idlekitjs/core` headless: the engine never
 * calls `requestAnimationFrame`/`performance.now` directly. The browser driver
 * lives in `@idlekitjs/browser` (`createRafScheduler`); tests and headless runtimes use
 * {@link manualScheduler}.
 */
export interface FrameScheduler {
  /** Begin driving frames. `now` is a millisecond timestamp from the driver. */
  start(onFrame: (now: number) => void): void;
  /** Stop driving frames. */
  stop(): void;
}

/** A manually driven scheduler: frames only advance when {@link ManualFrameScheduler.frame} is called. */
export interface ManualFrameScheduler extends FrameScheduler {
  /** Push a single frame with the given timestamp (ms). No-op when not started. */
  frame(now: number): void;
  /** Whether `start` has been called and `stop` has not. */
  readonly started: boolean;
}

/**
 * Headless scheduler with no auto-loop: nothing ticks until `frame(now)` is
 * called. Used as the default when no driver is injected (Node/tests) so the
 * loop never touches browser globals.
 */
export function manualScheduler(): ManualFrameScheduler {
  let onFrame: ((now: number) => void) | null = null;
  return {
    start(cb) {
      onFrame = cb;
    },
    stop() {
      onFrame = null;
    },
    frame(now) {
      onFrame?.(now);
    },
    get started() {
      return onFrame !== null;
    },
  };
}
