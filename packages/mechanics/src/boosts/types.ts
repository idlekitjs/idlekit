import type { Extension } from "@idlekitjs/types";
import type { Modifier, ModifierRegistry } from "../modifiers";

/**
 * What re-granting an already-active boost does:
 * - `refresh` (default): the timer restarts at `duration`;
 * - `extend`: `duration` seconds are added, capped by `maxDuration`;
 * - `stack`: one stack is added (up to `maxStacks`) and the timer restarts.
 */
export type BoostStacking = "refresh" | "extend" | "stack";

/**
 * Mechanic-only definition of a boost. Presentation stays on the game side,
 * optionally carried through `metadata`. Effects reuse the `Modifier` shape
 * from `@idlekitjs/mechanics/modifiers`: while the boost is active they are
 * published to the registry under the source `boost:<id>`.
 */
export interface BoostDef {
  /** Unique, stable identifier. */
  id: string;
  /** Seconds granted per grant (finite, > 0). */
  duration: number;
  /** Cap on the total remaining time (for `extend` and manual extends). */
  maxDuration?: number;
  /** Re-grant policy (default: "refresh"). */
  stacking?: BoostStacking;
  /** Cap on stacks for the `stack` policy (integer >= 1, default: unbounded). */
  maxStacks?: number;
  /**
   * Modifiers contributed while active. With multiple stacks, `add` values
   * scale linearly (`value * stacks`) and `mult` values compound
   * (`value ** stacks`).
   */
  effects?: Modifier[];
  /** Free-form data for the game (name, icon, ...). */
  metadata?: Record<string, unknown>;
}

/** Serializable runtime entry for one active boost. */
export interface ActiveBoost {
  id: string;
  /** Seconds left (mutated in place by `update`: no render depends on it). */
  remaining: number;
  /** Current stacks (>= 1; only grows under the `stack` policy). */
  stacks: number;
}

export interface BoostsOptions<T extends object> {
  definitions: BoostDef[];
  /** Read the live active-boost map from the state. */
  getActive: (state: T) => Record<string, ActiveBoost>;
  /** Reassign the active-boost map into the state (keeps reactivity). */
  setActive: (state: T, active: Record<string, ActiveBoost>) => void;
  /**
   * Registry the effects are published to (from the `modifiers` mechanic).
   * Optional: without it, boosts are pure timed statuses the game can query.
   */
  registry?: ModifierRegistry;
  /** Notified after a grant (initial or re-grant). */
  onGrant?: (boost: ActiveBoost, state: T) => void;
  /** Notified when a boost expires (timer or negative extend), not on `remove`. */
  onExpire?: (id: string, state: T) => void;
}

export interface BoostsExtension<T extends object> extends Extension<T> {
  /**
   * Grant a boost, applying its stacking policy when already active. Throws on
   * an unknown id (static-data error). Returns the resulting active entry.
   */
  grant(state: T, id: string): ActiveBoost;
  /**
   * Add `seconds` (can be negative) to an active boost, capped by
   * `maxDuration`. A result <= 0 expires the boost. Returns `false` when the
   * boost is not active.
   */
  extend(state: T, id: string, seconds: number): boolean;
  /** Deactivate a boost and retract its modifiers. `false` when not active. */
  remove(state: T, id: string): boolean;
  isActive(state: T, id: string): boolean;
  /** The active entry for `id`, if any. */
  get(state: T, id: string): ActiveBoost | undefined;
  /** Snapshot of every active boost. */
  active(state: T): ActiveBoost[];
  /** Republish every active boost's effects to the registry. */
  rebuildModifiers(state: T): void;
}
