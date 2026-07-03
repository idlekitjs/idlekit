import type { AmountsInput, Cost, Reward } from "../amounts/types";
import type { EconomyReader } from "../economy/types";
import type { Requirement } from "../requirements/types";
import type { ResourceDef, ResourceId } from "../resources/types";

/** Static amounts, or a function of the state (resolved once per preview). */
export type CostInput<T> = AmountsInput | ((state: T) => AmountsInput);
export type RewardInput<T> = AmountsInput | ((state: T) => AmountsInput);

/**
 * An atomic economic action: check requirements, pay the cost, apply the
 * effect, credit the reward — all or nothing. Transactions are for player
 * actions (buy, upgrade, claim, unlock...), never for simulation ticks.
 */
export interface Transaction<T> {
  /** Stable id (diagnostics, logging). */
  id: string;
  label?: string;
  /** Non-consuming conditions. Anything that can block belongs here. */
  requirements?: readonly Requirement<T>[];
  cost?: CostInput<T>;
  reward?: RewardInput<T>;
  /**
   * Domain effect, applied after the cost is paid and before the reward is
   * credited. It MUST NOT throw and MUST NOT fail: `execute` has already
   * mutated balances when it runs, and there is no rollback. Anything that
   * can block must be expressed as a requirement instead.
   */
  apply?: (state: T) => void;
  /** Free-form data for the game. Never read here. */
  metadata?: Record<string, unknown>;
}

/**
 * Why a transaction cannot run. All failures are collected (not just the
 * first) so a UI can display the complete picture at once.
 */
export type TransactionFailure =
  | { kind: "unknown-resource"; resourceId: ResourceId; where: "cost" | "reward" }
  | { kind: "invalid-amount"; resourceId: ResourceId; amount: number; where: "cost" | "reward" }
  /** The balance itself is unusable (NaN/Infinity) — a broken accessor or save. */
  | { kind: "invalid-state"; resourceId: ResourceId }
  | {
      kind: "requirement-failed";
      requirementId: string;
      label?: string;
      progress?: { current: number; target: number };
    }
  /** `available` is the spendable balance (current balance minus the resource's `min`). */
  | { kind: "cannot-afford"; resourceId: ResourceId; required: number; available: number }
  | { kind: "readonly-resource"; resourceId: ResourceId; where: "cost" | "reward" };

/** Pure evaluation of a transaction against the current state. */
export interface TransactionPreview {
  ok: boolean;
  failures: readonly TransactionFailure[];
  /** Resolved and normalized valid lines (invalid lines are in `failures`). */
  cost: Cost;
  reward: Reward;
  /** Shortfall per unaffordable cost line. */
  missing: Cost;
  /** Reward amounts that would be lost to `max` caps (informative, non-blocking). */
  overflow: Reward;
}

export type TransactionResult =
  | { ok: true; cost: Cost; reward: Reward; overflow: Reward }
  | { ok: false; failures: readonly TransactionFailure[]; missing: Cost };

/**
 * Registry surface the transaction pipeline needs; implemented by `Economy`.
 * `tryResource` is the diagnostic-friendly lookup (no throw on unknown ids).
 */
export interface TransactionResources<T> extends EconomyReader<T> {
  tryResource(id: ResourceId): ResourceDef<T> | undefined;
}

/** Adds the mutation primitive `execute` needs on top of the read surface. */
export interface TransactionExecutor<T> extends TransactionResources<T> {
  /** Clamped add through a definition; returns the delta actually applied. */
  applyClamped(state: T, def: ResourceDef<T>, amount: number): number;
}
