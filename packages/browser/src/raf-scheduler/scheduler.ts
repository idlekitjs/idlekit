import type { FrameScheduler } from "@idlekitjs/core";

/**
 * Browser frame driver for the engine loop, backed by `requestAnimationFrame`.
 *
 * This is the platform half that keeps `@idlekitjs/core` headless: the timestamp
 * passed to `onFrame` is the rAF `DOMHighResTimeStamp`, so the core loop never
 * calls `performance.now` or `requestAnimationFrame` itself. It is not tied to
 * the DOM renderer — any browser-rendered view (DOM, canvas, React, ...) can
 * drive the engine with it.
 *
 * Usage:
 *
 *   import { createRafScheduler } from "@idlekitjs/browser/raf-scheduler";
 *   const engine = createEngine({ initialState, renderer, scheduler: createRafScheduler() });
 */
export function createRafScheduler(): FrameScheduler {
  let rafId: number | null = null;
  return {
    start(onFrame) {
      const tick = (now: number): void => {
        onFrame(now);
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    },
    stop() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
  };
}
