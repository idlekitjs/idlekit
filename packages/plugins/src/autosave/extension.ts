import type { Extension } from "@idlekitjs/types";
import type { SaveManager } from "@idlekitjs/core";
import { SaveScheduler } from "./scheduler";

export interface AutosaveOptions<T extends object> {
  manager: SaveManager<T>;
  getState: () => T;
  /** Periodic autosave interval in milliseconds. */
  intervalMs?: number;
}

/**
 * Saving: drives a `SaveScheduler` (periodic autosave + save on background and
 * close) for the lifetime of the game.
 *
 * Guard: a missing `manager` or `getState` throws at wiring time (clear failure)
 * rather than silently losing saves at runtime.
 */
export function autosave<T extends object>(options: AutosaveOptions<T>): Extension<T> {
  if (!options?.manager) {
    throw new Error("autosave: the `manager` option (SaveManager) is required.");
  }
  if (typeof options.getState !== "function") {
    throw new Error("autosave: the `getState` option (() => T) is required.");
  }
  let scheduler: SaveScheduler<T> | null = null;
  return {
    id: "autosave",
    setup() {
      scheduler = new SaveScheduler<T>({
        manager: options.manager,
        getState: options.getState,
        intervalMs: options.intervalMs,
      });
      scheduler.start();
    },
    teardown() {
      scheduler?.stop();
      scheduler = null;
    },
  };
}
