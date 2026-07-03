import type { AmountsInput, Cost, Reward } from "../amounts/types";
import type { FormattedAmount, FormattedCostLine } from "../format/types";
import type { ResourceDef, ResourceId, ResourceInit } from "../resources/types";
import type {
  Transaction,
  TransactionFailure,
  TransactionPreview,
  TransactionResult,
} from "../transactions/types";

export interface EconomyOptions {
  /**
   * Economy-wide amount formatter (games typically pass core's
   * `formatNumber`). Per-resource `format` overrides it. Default: `String`.
   */
  format?: (amount: number) => string;
}

/**
 * Read-only slice of an economy: what requirements, previews and adapters
 * need. `get`/`resource` throw on unknown ids — reads are code, not content.
 */
export interface EconomyReader<T> {
  has(id: ResourceId): boolean;
  get(state: T, id: ResourceId): number;
  resource(id: ResourceId): ResourceDef<T>;
}

/**
 * The economy instance: an explicit registry of resources plus the runtime to
 * move them (direct operations, bulk cost/reward operations, transactions,
 * formatting). It never owns the state — every read/write goes through the
 * declared accessors.
 *
 * Error channels, by design:
 * - code path (`get`, `add`, `spend`, `pay`, `credit`, direct lookups): throws
 *   `EconomyError` on unknown ids or invalid amounts — programming errors;
 * - data path (`preview`, `execute`): never throws for content-shaped input,
 *   returns `TransactionFailure` diagnostics instead.
 */
export interface Economy<T> extends EconomyReader<T> {
  /** Register a resource (chainable). Throws on invalid or duplicate id. */
  resource(init: ResourceInit<T>): this;
  /** Look up a registered resource. Throws on unknown id. */
  resource(id: ResourceId): ResourceDef<T>;
  /** Register several resources at once (chainable). */
  resources(inits: readonly ResourceInit<T>[]): this;

  /** Every registered id, in registration order. */
  ids(): readonly ResourceId[];

  /**
   * Add `amount` (negative to subtract), clamped into the resource bounds.
   * Returns the delta actually applied (may differ from `amount` at a bound).
   */
  add(state: T, id: ResourceId, amount: number): number;
  /**
   * Spend exactly `amount` if the spendable balance covers it. Atomic:
   * returns `false` (and mutates nothing) when short.
   */
  spend(state: T, id: ResourceId, amount: number): boolean;

  canAfford(state: T, cost: AmountsInput): boolean;
  /** Shortfall per resource (`cost - spendable`, only lines that are short). */
  missing(state: T, cost: AmountsInput): Cost;
  /** Debit a whole cost. Throws when any line is unaffordable; mutates nothing then. */
  pay(state: T, cost: AmountsInput): void;
  /** Credit a whole reward, clamped by `max` caps. Returns the overflow lost to caps. */
  credit(state: T, reward: AmountsInput): Reward;

  preview(state: T, transaction: Transaction<T>): TransactionPreview;
  execute(state: T, transaction: Transaction<T>): TransactionResult;
  /** Shorthand for `preview(...).ok`. */
  canExecute(state: T, transaction: Transaction<T>): boolean;

  formatAmount(id: ResourceId, amount: number): string;
  formatCost(state: T, cost: AmountsInput): readonly FormattedCostLine[];
  formatReward(reward: AmountsInput): readonly FormattedAmount[];

  /**
   * Dev/test sweep of every registered resource: reports `invalid-state` for
   * NaN/Infinity balances, balances out of `[min, max]`, and fractional
   * balances on integer resources. Assert it returns `[]` in game tests.
   */
  audit(state: T): readonly TransactionFailure[];
}
