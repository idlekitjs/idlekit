import type { Extension } from "@idlekitjs/types";

export interface OfflineProgressOptions {
  /** Cap on credited offline time, in milliseconds. Default: 24 h. */
  maxMs?: number;
}

/** Default cap: avoids crediting an absurd amount of time if `savedAt` is wrong. */
const DEFAULT_MAX_MS = 24 * 60 * 60 * 1000;

/**
 * Offline progress: advances the simulation by the elapsed time when a save is
 * loaded (`loaded` event) and when returning from the background (`resume`),
 * within the `maxMs` limit.
 *
 * Guard: a missing, non-finite or negative `maxMs` falls back to the default
 * (24 h), and any negative elapsed time (inconsistent clock) is ignored.
 */
export function offlineProgress<T extends object>(
  options: OfflineProgressOptions = {},
): Extension<T> {
  const maxMs =
    typeof options.maxMs === "number" && options.maxMs > 0 ? options.maxMs : DEFAULT_MAX_MS;
  return {
    id: "offline-progress",
    setup(engine) {
      const catchUp = (elapsedMs: number): void => {
        const capped = Math.min(Math.max(elapsedMs, 0), maxMs);
        if (capped > 0) {
          engine.advance(capped / 1000);
        }
      };
      engine.events.on("resume", catchUp);
      engine.events.on("loaded", (savedAt) => {
        if (savedAt > 0) {
          catchUp(Date.now() - savedAt);
        }
      });
    },
  };
}
