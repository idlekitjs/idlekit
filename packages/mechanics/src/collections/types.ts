import type { Extension } from "@idlekitjs/types";
import type { ModifierRegistry, ModifierTarget } from "../modifiers";

/** Value of a stat as a function of the collectible's level (0 = inactive). */
export type Curve = (level: number) => number;

/** Predicate over the game state, used to gate visibility / drops / upgrades. */
export type Condition<T extends object> = (state: T) => boolean;

/**
 * A single bonus contributed by a collectible. Same shape as a `Modifier` but
 * the magnitude depends on the level, so it is published to the registry
 * resolved at the current level (`value(level)`).
 */
export interface CollectibleEffect {
  target: ModifierTarget;
  /** Stat affected, e.g. "yield" or "speed". */
  stat: string;
  op: "add" | "mult";
  value: Curve;
}

/** A currency cost for the upgrade `level -> level + 1`. */
export interface CostDef {
  currency: string;
  amount: Curve;
}

/** Upgrade economy for a collectible (curves are read at the current level). */
export interface UpgradeDef {
  /** Duplicates consumed for `level -> level + 1` (default: none). */
  duplicates?: Curve;
  /** Currency costs for `level -> level + 1` (default: none). */
  costs?: CostDef[];
  /** Maximum reachable level (default: unbounded). */
  maxLevel?: number;
}

/**
 * Eligibility gates. Each predicate defaults to permissive (`true`), except
 * where noted. They let the game forbid drops/upgrades of content the player has
 * not unlocked yet, and hide undiscovered entries.
 */
export interface Eligibility<T extends object> {
  /** Shown in the collection UI (default: true). */
  visible?: Condition<T>;
  /** Can drop from packs (default: true). */
  droppable?: Condition<T>;
  /** Effects are applied to the registry (default: true). */
  active?: Condition<T>;
  /** Can be upgraded right now (default: true). */
  upgradeable?: Condition<T>;
}

/** Mechanic-only definition of a collectible (card). Presentation stays game-side. */
export interface CollectibleDef<T extends object> {
  /** Unique, stable identifier. */
  id: string;
  /** Rarity bucket, referencing a {@link RarityDef.id}. */
  rarity: string;
  /** Group labels (also matched by `tag` modifier targets via the effects). */
  tags?: string[];
  /** Bonuses granted while owned and active. */
  effects?: CollectibleEffect[];
  /** Upgrade economy; falls back to the rarity defaults when omitted. */
  upgrade?: UpgradeDef;
  eligibility?: Eligibility<T>;
  /** Free-form data for the game (name, icon, description...). */
  metadata?: Record<string, unknown>;
}

/** A rarity bucket: drop weight and shared upgrade defaults. */
export interface RarityDef {
  id: string;
  /** Base relative drop weight (overridable per pack). */
  weight: number;
  /** Upgrade economy inherited by collectibles that omit their own. */
  defaults?: UpgradeDef;
  metadata?: Record<string, unknown>;
}

export interface WeightedIntChoice {
  value: number;
  weight: number;
}

export type WeightedInt = number | { choices: WeightedIntChoice[] } | { min: number; max: number };

export type PackRewardDef =
  | {
      kind: "cards";
      /** Number of card copies to draw. */
      count: WeightedInt;
      /** Fixed rarity for every card in this reward line. */
      rarity?: string;
      /** Rarity weights for this reward line. Defaults to rarity weights. */
      rarityWeights?: Record<string, number>;
    }
  | {
      kind: "currency";
      currency: string;
      amount: WeightedInt;
    };

/** A pack the player can open to draw collectibles. */
export interface PackDef<T extends object> {
  id: string;
  /** Collectibles drawn per open by the legacy rarity-weighted pack model. */
  draws?: WeightedInt;
  /** Per-pack overrides of the base rarity weights. */
  rarityWeights?: Record<string, number>;
  /** Declarative rewards. When present, these replace the legacy draws model. */
  rewards?: PackRewardDef[];
  eligibility?: Pick<Eligibility<T>, "visible"> & {
    /** Can be opened right now (default: true). */
    openable?: Condition<T>;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Mutable accessor for a currency held in the game state. `spend` and `add`
 * mutate the reactive store directly (consistent with the proxy model).
 */
export interface CurrencyAccessor<T extends object> {
  id: string;
  get: (state: T) => number;
  spend: (state: T, amount: number) => void;
  add?: (state: T, amount: number) => void;
}

/** Per-collectible save entry. */
export interface CollectibleEntry {
  /** Copies held (spent when upgrading). */
  quantity: number;
  /** Current level (0 = owned-but-inactive / not yet upgraded). */
  level: number;
}

/**
 * Serializable collection sub-state. Lives under one key of the game state; the
 * registry of active effects is rebuilt from it on load (never serialized).
 */
export interface CollectionData {
  collectibles: Record<string, CollectibleEntry>;
  /** Persisted PRNG state so drops are reproducible across reloads. */
  rngState: number;
}

export interface CollectionOptions<T extends object> {
  rarities: RarityDef[];
  collectibles: CollectibleDef<T>[];
  packs: PackDef<T>[];
  currencies: CurrencyAccessor<T>[];
  /** Registry the effects are published to (from the `modifiers` plugin). */
  registry: ModifierRegistry;
  /** Read the live collection sub-state. */
  getData: (state: T) => CollectionData;
  /** Replace the collection sub-state (reassign for reactivity). */
  setData: (state: T, data: CollectionData) => void;
  /** Seed used when the state has no PRNG state yet (default: time-based). */
  seed?: number;
  /** Notified after a mutating operation (open / upgrade), e.g. to save. */
  onChange?: (state: T) => void;
}

/** A reward line produced by opening a pack. */
export type OpenPackReward =
  | {
      kind: "card";
      collectibleId: string;
      rarity: string;
      quantity: number;
      previousQuantity: number;
      newQuantity: number;
      /** First copy ever obtained. */
      wasNew: boolean;
      /** Whether the collectible is upgradeable right after this draw. */
      canUpgradeAfter: boolean;
    }
  | {
      kind: "currency";
      currencyId: string;
      amount: number;
      previousAmount: number;
      newAmount: number;
    };

export interface OpenPackResult {
  packId: string;
  rewards: OpenPackReward[];
}

/** Detailed requirements for the next upgrade of a collectible. */
export interface UpgradeRequirements {
  level: number;
  nextLevel: number;
  duplicatesRequired: number;
  duplicatesAvailable: number;
  costs: { currency: string; required: number; available: number }[];
}

export type UpgradeBlockedReason =
  "not-owned" | "max-level" | "not-enough-duplicates" | "not-enough-currency" | "not-eligible";

export type UpgradeCheck =
  | { ok: true; requirements: UpgradeRequirements }
  | { ok: false; reason: UpgradeBlockedReason; requirements: UpgradeRequirements };

/** Read-only view of a collectible for the UI. */
export interface CollectibleView {
  id: string;
  rarity: string;
  level: number;
  quantity: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface CollectionExtension<T extends object> extends Extension<T> {
  /** Open a pack: draw, credit copies, persist the PRNG state. */
  openPack(packId: string, state: T): OpenPackResult;
  /** Inspect the next upgrade (requirements and blocking reason, if any). */
  canUpgrade(id: string, state: T): UpgradeCheck;
  /** Consume duplicates + currencies, level up, republish effects. */
  upgrade(id: string, state: T): boolean;
  /** UI view of a single collectible, or `undefined` if unknown. */
  getCollectible(id: string, state: T): CollectibleView | undefined;
  /** UI views of every currently visible collectible. */
  getVisible(state: T): CollectibleView[];
  /** Republish every active collectible's effects to the registry. */
  rebuildModifiers(state: T): void;
}
