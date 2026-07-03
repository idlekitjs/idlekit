/**
 * Stable identifier of a declared resource. Plain string on purpose: game
 * content is written as literals, and the registry already catches unknown or
 * duplicate ids at wiring time, so a branded type would only add casts.
 *
 * Recommended (not enforced) convention: `namespace:name`, e.g.
 * `currency:potatoes`, `producer:collective`, `card:collective-manager:shards`.
 */
export type ResourceId = string;

/**
 * How a named scalar is read from / written into the game state. The accessor
 * is the *only* thing Economy knows about the state shape: the state stays
 * owned by the game and is never scanned.
 */
export interface ResourceAccessor<T> {
  get(state: T): number;
  /**
   * Add `amount` (negative to subtract). Implementations must respect the
   * game's reactivity model: mutate scalars in place, clone-and-reassign
   * collections (see the accessors module for ready-made shapes).
   */
  add(state: T, amount: number): void;
}

/**
 * Author-facing resource declaration. Two equivalent syntaxes are accepted:
 * a prebuilt `accessor`, or inline `get`/`add`. `defineResource` normalizes
 * both into a {@link ResourceDef}.
 */
export type ResourceInit<T> = {
  id: ResourceId;
  /** Display name (defaults to the id). */
  label?: string;
  description?: string;
  /** Per-resource amount formatter; overrides the economy-wide one. */
  format?: (amount: number) => string;
  /**
   * Amounts moved through Economy must be whole numbers. Validated, never
   * silently rounded: rounding is owned by cost curves and callers.
   */
  integer?: boolean;
  /** Balance floor (default 0). `add` clamps the balance into `[min, max]`. */
  min?: number;
  /** Balance cap (default +Infinity). Credits clamp; previews report overflow. */
  max?: number;
  /** Group labels, e.g. for filtering in devtools or targeted formatting. */
  tags?: readonly string[];
  /** Free-form data for the game (icon, color, category...). Never read here. */
  metadata?: Record<string, unknown>;
} & (
  | {
      accessor: ResourceAccessor<T>;
      get?: never;
      add?: never;
    }
  | {
      accessor?: never;
      get: (state: T) => number;
      add: (state: T, amount: number) => void;
    }
);

/**
 * Normalized resource definition: what the registry stores. A `ResourceDef`
 * never owns the value (the game state does) and never references an Economy
 * instance, so the same definition can be registered in several economies
 * (useful in tests).
 */
export interface ResourceDef<T> {
  id: ResourceId;
  label: string;
  description?: string;
  accessor: ResourceAccessor<T>;
  format?: (amount: number) => string;
  integer: boolean;
  min: number;
  max: number;
  /**
   * Observable but not creditable/spendable (built with the `readonly`
   * accessor). Usable in requirements and formatting; rejected in cost/reward.
   */
  readonly: boolean;
  tags: readonly string[];
  metadata?: Record<string, unknown>;
}
