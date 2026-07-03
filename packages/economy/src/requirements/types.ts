import type { EconomyReader } from "../economy/types";

/**
 * A non-consuming condition on a transaction: it observes the state, never
 * mutates it. The boundary with `Cost` is consumption — "hold 100 potatoes" is
 * a requirement, "spend 100 potatoes" is a cost. Never model a gate as a
 * zero cost.
 */
export interface Requirement<T> {
  /** Stable id, reported in `requirement-failed` diagnostics. */
  id: string;
  /** Display text for the UI (also carried into diagnostics). */
  label?: string;
  /**
   * The economy is passed in so resource-based requirements need no closure
   * over it; custom state predicates can simply ignore the second argument.
   */
  isMet(state: T, economy: EconomyReader<T>): boolean;
  /** Optional progress detail for UI (e.g. "12 / 25 potatoes"). */
  progress?(state: T, economy: EconomyReader<T>): { current: number; target: number };
}
