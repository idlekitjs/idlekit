import { clamp } from "@idlekitjs/utils";
import { normalizeAmounts } from "../amounts/normalize";
import type { AmountsInput, Cost, ResourceAmount, Reward } from "../amounts/types";
import type { FormattedAmount, FormattedCostLine } from "../format/types";
import { defineResource } from "../resources/define";
import type { ResourceDef, ResourceId, ResourceInit } from "../resources/types";
import { executeTransaction } from "../transactions/execute";
import { previewTransaction } from "../transactions/preview";
import type {
  Transaction,
  TransactionExecutor,
  TransactionFailure,
  TransactionPreview,
  TransactionResult,
} from "../transactions/types";
import { EconomyError } from "./errors";
import type { Economy, EconomyOptions } from "./types";

/**
 * Create an economy instance. Registration is chainable and append-only (no
 * removal, no overwrite: a duplicate id throws at wiring time). There is no
 * `.build()` step — the instance is usable as soon as its resources are in.
 *
 * Several economies over the same state are technically fine (definitions are
 * pure); one economy per game is the norm.
 */
export function createEconomy<T>(options: EconomyOptions = {}): Economy<T> {
  return new EconomyImpl<T>(options);
}

class EconomyImpl<T> implements Economy<T> {
  private readonly defs = new Map<ResourceId, ResourceDef<T>>();
  private readonly formatDefault: (amount: number) => string;
  /** Shared surface for the transaction pipeline (see transactions/types). */
  private readonly executor: TransactionExecutor<T>;

  constructor(options: EconomyOptions) {
    this.formatDefault = options.format ?? ((amount: number): string => String(amount));
    this.executor = {
      has: (id) => this.has(id),
      get: (state, id) => this.get(state, id),
      resource: (id) => this.require(id),
      tryResource: (id) => this.defs.get(id),
      applyClamped: (state, def, amount) => this.applyClamped(state, def, amount),
    };
  }

  // --- registry ------------------------------------------------------------

  resource(init: ResourceInit<T>): this;
  resource(id: ResourceId): ResourceDef<T>;
  resource(idOrInit: ResourceId | ResourceInit<T>): this | ResourceDef<T> {
    if (typeof idOrInit === "string") {
      return this.require(idOrInit);
    }
    const def = defineResource(idOrInit);
    if (this.defs.has(def.id)) {
      throw new EconomyError(
        `Resource "${def.id}" is already registered (as "${this.defs.get(def.id)!.label}").`,
      );
    }
    this.defs.set(def.id, def);
    return this;
  }

  resources(inits: readonly ResourceInit<T>[]): this {
    for (const init of inits) {
      this.resource(init);
    }
    return this;
  }

  has(id: ResourceId): boolean {
    return this.defs.has(id);
  }

  ids(): readonly ResourceId[] {
    return [...this.defs.keys()];
  }

  // --- direct operations (code path: throws on misuse) ----------------------

  get(state: T, id: ResourceId): number {
    return this.require(id).accessor.get(state);
  }

  add(state: T, id: ResourceId, amount: number): number {
    const def = this.require(id);
    this.assertWritable(def, amount);
    return this.applyClamped(state, def, amount);
  }

  spend(state: T, id: ResourceId, amount: number): boolean {
    const def = this.require(id);
    this.assertWritable(def, amount);
    if (amount < 0) {
      throw new EconomyError(`Cannot spend a negative amount of "${id}" (use add).`);
    }
    if (this.spendable(state, def) < amount) {
      return false;
    }
    def.accessor.add(state, -amount);
    return true;
  }

  // --- bulk cost/reward operations ------------------------------------------

  canAfford(state: T, cost: AmountsInput): boolean {
    return this.shortfall(state, cost).length === 0;
  }

  missing(state: T, cost: AmountsInput): Cost {
    return this.shortfall(state, cost);
  }

  pay(state: T, cost: AmountsInput): void {
    const lines = normalizeAmounts(cost);
    // Validate everything before mutating anything: pay is atomic.
    for (const line of lines) {
      const def = this.require(line.resourceId);
      this.assertWritable(def, line.amount);
      if (this.spendable(state, def) < line.amount) {
        throw new EconomyError(
          `Cannot pay ${line.amount} of "${line.resourceId}": check canAfford first.`,
        );
      }
    }
    for (const line of lines) {
      this.require(line.resourceId).accessor.add(state, -line.amount);
    }
  }

  credit(state: T, reward: AmountsInput): Reward {
    const lines = normalizeAmounts(reward);
    for (const line of lines) {
      this.assertWritable(this.require(line.resourceId), line.amount);
    }
    const overflow: ResourceAmount[] = [];
    for (const line of lines) {
      const applied = this.applyClamped(state, this.require(line.resourceId), line.amount);
      if (applied < line.amount) {
        overflow.push({ resourceId: line.resourceId, amount: line.amount - applied });
      }
    }
    return overflow;
  }

  // --- transactions (data path: diagnostics, no throw for content) ----------

  preview(state: T, transaction: Transaction<T>): TransactionPreview {
    return previewTransaction(this.executor, state, transaction);
  }

  execute(state: T, transaction: Transaction<T>): TransactionResult {
    return executeTransaction(this.executor, state, transaction);
  }

  canExecute(state: T, transaction: Transaction<T>): boolean {
    return this.preview(state, transaction).ok;
  }

  // --- formatting ------------------------------------------------------------

  formatAmount(id: ResourceId, amount: number): string {
    const def = this.require(id);
    return (def.format ?? this.formatDefault)(amount);
  }

  formatCost(state: T, cost: AmountsInput): readonly FormattedCostLine[] {
    return normalizeAmounts(cost).map((line) => {
      const def = this.require(line.resourceId);
      const available = this.spendable(state, def);
      return {
        resourceId: line.resourceId,
        label: def.label,
        amount: this.formatAmount(line.resourceId, line.amount),
        rawAmount: line.amount,
        available,
        affordable: available >= line.amount,
      };
    });
  }

  formatReward(reward: AmountsInput): readonly FormattedAmount[] {
    return normalizeAmounts(reward).map((line) => ({
      resourceId: line.resourceId,
      label: this.require(line.resourceId).label,
      amount: this.formatAmount(line.resourceId, line.amount),
      rawAmount: line.amount,
    }));
  }

  // --- diagnostics ------------------------------------------------------------

  audit(state: T): readonly TransactionFailure[] {
    const failures: TransactionFailure[] = [];
    for (const def of this.defs.values()) {
      const balance = def.accessor.get(state);
      const broken =
        !Number.isFinite(balance) ||
        balance < def.min ||
        balance > def.max ||
        (def.integer && !Number.isInteger(balance));
      if (broken) {
        failures.push({ kind: "invalid-state", resourceId: def.id });
      }
    }
    return failures;
  }

  // --- internals ------------------------------------------------------------

  private require(id: ResourceId): ResourceDef<T> {
    const def = this.defs.get(id);
    if (!def) {
      throw new EconomyError(`Unknown resource "${id}". Register it before use.`);
    }
    return def;
  }

  /** Spendable balance: what can be paid without crossing the resource floor. */
  private spendable(state: T, def: ResourceDef<T>): number {
    return def.accessor.get(state) - def.min;
  }

  private applyClamped(state: T, def: ResourceDef<T>, amount: number): number {
    const current = def.accessor.get(state);
    const delta = clamp(current + amount, def.min, def.max) - current;
    if (delta !== 0) {
      def.accessor.add(state, delta);
    }
    return delta;
  }

  private assertWritable(def: ResourceDef<T>, amount: number): void {
    if (def.readonly) {
      throw new EconomyError(`Resource "${def.id}" is read-only.`);
    }
    if (!Number.isFinite(amount)) {
      throw new EconomyError(`Invalid amount ${amount} for "${def.id}".`);
    }
    if (def.integer && !Number.isInteger(amount)) {
      throw new EconomyError(
        `Resource "${def.id}" is integer: amount ${amount} must be a whole number.`,
      );
    }
  }

  private shortfall(state: T, cost: AmountsInput): ResourceAmount[] {
    const missing: ResourceAmount[] = [];
    for (const line of normalizeAmounts(cost)) {
      const def = this.require(line.resourceId);
      const gap = line.amount - this.spendable(state, def);
      if (gap > 0) {
        missing.push({ resourceId: line.resourceId, amount: gap });
      }
    }
    return missing;
  }
}
