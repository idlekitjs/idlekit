import type { Extension } from "@idlekitjs/types";

/**
 * Mechanic-only definition of a recurring timer. What firing *does* stays on
 * the game side (`onFire`): the mechanic only owns the periodic scheduling.
 */
export interface TimerDef {
  /** Unique, stable identifier. */
  id: string;
  /** Seconds between firings (finite > 0). */
  every: number;
  /** Running from the start (default true). */
  autoStart?: boolean;
  /** Free-form data for the game (name, icon, ...). */
  metadata?: Record<string, unknown>;
}

/**
 * Serializable runtime entry for one timer.
 * - `remaining` is mutated in place by `update` (no render depends on it);
 * - `running` changes are reassigned through `setData` (render-relevant).
 */
export interface TimerState {
  /** Seconds left until the next firing. */
  remaining: number;
  running: boolean;
}

/** Serializable timers sub-state, keyed by timer id. */
export type TimersData = Record<string, TimerState>;

export interface TimersOptions<T extends object> {
  definitions: readonly TimerDef[];
  /** Read the live timers sub-state (missing entries default from the defs). */
  getData(state: T): TimersData;
  /** Replace the timers sub-state (reassign for reactivity). */
  setData(state: T, data: TimersData): void;
  /**
   * Notified when a timer fires. `fires > 1` when a large `dt` (offline
   * catch-up) covers several periods — handle them in one call.
   */
  onFire?(id: string, state: T, fires: number): void;
}

export interface TimersExtension<T extends object> extends Extension<T> {
  /** Resume a stopped timer (progress is kept, not reset). `false` on unknown id. */
  start(state: T, id: string): boolean;
  /** Pause a timer, freezing its progress. `false` on unknown id. */
  stop(state: T, id: string): boolean;
  isRunning(state: T, id: string): boolean;
  /** Fire once manually (running or not) and reset the period. `false` on unknown id. */
  trigger(state: T, id: string): boolean;
  /** Progress toward the next firing, in `[0, 1]` (for a bar). */
  progressFraction(state: T, id: string): number;
}
