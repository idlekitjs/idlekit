import type { Extension } from "@idlekitjs/types";

/**
 * Mechanic-only definition of a producer tier. Presentation (name, icon,
 * description) stays on the game side: the plugin never needs it.
 *
 * Cycle model (AdVenture Communist style): a tier accumulates time and, when a
 * cycle completes, emits a *batch* at once (`count * yieldPerUnit`). A continuous
 * model (AdVenture Capitalist style) is the limit case of a tiny `cycleTime`,
 * the carried-over remainder keeping the average rate exact.
 */
export interface ProducerDef {
  /** Unique, stable identifier (diagnostics / save mapping by index). */
  id: string;
  /** Seconds of accumulated time per produced batch. */
  cycleTime: number;
  /** Units produced per owned unit, per completed cycle. */
  yieldPerUnit: number;
  /** Resource cost of the first unit. */
  baseCost: number;
  /** Cost multiplier applied per unit already purchased. */
  costGrowth: number;
  /** Group labels for targeted modifiers (e.g. "producer:comrade"). */
  tags?: string[];
}

/**
 * Parallel arrays, indexed like the `definitions`:
 * - `owned`    : units purchased (integer) -> drives the cost curve;
 * - `total`    : units present (owned + produced by the tier above) -> drives output;
 * - `progress` : seconds accumulated toward the next cycle;
 * - `running`  : manual-cycle flags (only read for non-automated tiers; absent
 *                means "no manual cycle in flight", so old saves keep working).
 *
 * Stored in the game state (serializable). `total` and `running` are reassigned
 * on change (so the reactive store sees it); `progress` is mutated in place.
 * Render cycle progress bars with a frame callback (for example
 * `renderer.addFrame`), not a reactive binding that only runs on dirty keys.
 */
export interface ProducerColumn {
  owned: number[];
  total: number[];
  progress: number[];
  running?: boolean[];
}

export interface ProducersOptions<T extends object> {
  definitions: ProducerDef[];
  /** Read the live producer arrays from the state. */
  getColumn: (state: T) => ProducerColumn;
  /** Reassign the given arrays into the state (keeps reactivity). */
  setColumn: (state: T, patch: Partial<ProducerColumn>) => void;
  /**
   * Resource produced by tier 0 — and, unless {@link purchase} is provided,
   * the default currency spent when purchasing units.
   */
  resource: {
    get: (state: T) => number;
    add: (state: T, amount: number) => void;
  };
  /**
   * Payment seam: where the scalar budget for purchasing tier `index` comes
   * from, and how it is debited. The mechanic computes costs (geometric curve)
   * but never knows what is consumed — the game decides per tier (main
   * currency, an inventory count, anything scalar). Default: the main
   * `resource` (`getBudget` reads it, `pay` debits it).
   */
  purchase?: {
    /** Available scalar budget for purchasing tier `index`. */
    getBudget: (state: T, index: number) => number;
    /** Pays `amount` from the budget used to purchase tier `index`. */
    pay: (state: T, index: number, amount: number) => void;
  };
  /**
   * Whether tier `index` cycles on its own (default: true). A non-automated
   * tier only advances while a manual cycle is running — see
   * {@link ProducersExtension.run}.
   */
  getIsAutomated?: (state: T, index: number) => boolean;
  /**
   * Effective output multiplier for tier `index` (default: 1). Multiplies the
   * units emitted per cycle. Fed by a modifier registry in later stages.
   */
  getYieldMultiplier?: (state: T, index: number) => number;
  /**
   * Effective speed multiplier for tier `index` (default: 1). Divides the
   * `cycleTime`, so cycles complete proportionally faster. A value <= 0 stops
   * the tier.
   */
  getSpeedMultiplier?: (state: T, index: number) => number;
  /** Notified after a successful purchase (e.g. to trigger a save). */
  onPurchase?: (index: number, state: T, result: PurchaseResult) => void;
}

export interface PurchaseResult {
  /** Units effectively purchased. */
  bought: number;
  /** Exact budget spent by this transaction. */
  spent: number;
  /** Budget remaining for this tier after the transaction. */
  remaining: number;
}

export interface ProducersExtension<T extends object> extends Extension<T> {
  /** Try to purchase one unit of tier `index`. Returns `true` on success. */
  purchase(index: number, state: T): boolean;
  /** Cost of the next unit of tier `index`, in the tier's budget. */
  cost(index: number, state: T): number;
  /** Cost of `quantity` consecutive units from the current owned count. */
  costFor(index: number, state: T, quantity: number): number;
  /** Maximum units affordable with `budget` (or the tier's current budget if omitted). */
  maxAffordable(index: number, state: T, budget?: number): number;
  /** Try to purchase up to `quantity` units. */
  purchaseMany(index: number, state: T, quantity: number): PurchaseResult;
  /**
   * Add `quantity` whole units of tier `index` without paying anything —
   * mission rewards, crates, debug tools, or a purchase settled outside the
   * scalar seam (e.g. an economy transaction with a multi-resource cost).
   * By default the units are a pure gift (`total` only, like starter units);
   * `owned: true` also advances the purchase count, so the cost curve grows
   * exactly as if the units had been bought. Returns `false` on an invalid
   * index or quantity. Does not notify `onPurchase`.
   */
  grant(index: number, state: T, quantity: number, options?: { owned?: boolean }): boolean;
  /** Purchase as many units as possible with the given budget. */
  purchaseWithBudget(index: number, state: T, budget: number): PurchaseResult;
  /**
   * Start one manual cycle of the non-automated tier `index`. Returns `false`
   * when the index is invalid, the tier is empty, the tier is automated
   * (already cycling), or a manual cycle is already in flight; `true` once the
   * cycle is armed. Accumulated progress is resumed, not reset.
   */
  run(index: number, state: T): boolean;
  /**
   * Whether tier `index` is currently cycling: an automated tier is running
   * whenever it has units; a manual tier only while a started cycle is in
   * flight. (Orthogonal to the `speed <= 0` pause, which freezes progress.)
   */
  isRunning(state: T, index: number): boolean;
  /** Average output of tier `index` per second (for display). */
  ratePerSecond(state: T, index?: number): number;
  /**
   * Progress toward the next cycle of tier `index`, in `[0, 1]` (for a bar).
   * This can change continuously from in-place state, so render it from a
   * frame callback. Reactive bindings are still right for counts, costs and
   * affordability labels.
   */
  progressFraction(state: T, index: number): number;
  /**
   * Real seconds per cycle of tier `index` after the speed multiplier
   * (`Infinity` when the tier is stopped). A tiny value means cycles complete
   * faster than a frame, so the UI should switch to a continuous indicator
   * rather than a filling bar.
   */
  effectiveCycleTime(state: T, index: number): number;
}
