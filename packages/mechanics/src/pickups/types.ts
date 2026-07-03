import type { Extension } from "@idlekitjs/types";

/** Plain 2D coordinates. Their unit/space is the game's business. */
export interface PickupPosition {
  x: number;
  y: number;
}

/**
 * Mechanic-only definition of a pickup type: a temporary, individually
 * identifiable item the player can act on before it expires. Presentation
 * (image, CSS class, ...) stays on the game side, carried through `metadata`
 * — the mechanic never interprets assets.
 */
export interface PickupDef<T extends object> {
  /** Unique, stable type identifier. */
  id: string;
  /** Seconds before an uncollected item expires (finite > 0; omit = never). */
  lifetime?: number;
  /**
   * Automatic spawning; omit for manual `spawn()` only. Auto-spawned types
   * must be bounded: declare `lifetime` and/or `max`, so a large offline `dt`
   * cannot create unbounded work.
   */
  spawn?: {
    /** Seconds between spawns (finite > 0). */
    every: number;
    /** Cap on simultaneously active items of this type (integer >= 1). */
    max?: number;
    /** Spawn eligibility (default: always). While false, no time accumulates. */
    when?: (state: T) => boolean;
  };
  /** Position factory for spawned items (`random` is the persisted PRNG). */
  position?: (state: T, random: () => number) => PickupPosition;
  /** Free-form data for the game (image, class, ...). */
  metadata?: Record<string, unknown>;
}

/**
 * Serializable active item. Exists in state only while active: collected and
 * expired items are removed, no status field is stored. `remaining` is
 * mutated in place by `update` (continuous countdowns render via frame
 * bindings, not dirty keys).
 */
export interface PickupItem {
  /** Unique instance id: `<type>#<n>`. */
  id: string;
  type: string;
  /** Seconds left before expiry (absent = never expires). */
  remaining?: number;
  /** Total lifetime at spawn (absent = never expires). Kept for UI fractions. */
  lifetime?: number;
  position?: PickupPosition;
  metadata?: Record<string, unknown>;
}

/**
 * Serializable pickups sub-state. `items` is reassigned on add/remove
 * (reactivity); `spawnProgress` is mutated in place; `rngState` persists the
 * PRNG so random positions are reproducible across reloads.
 */
export interface PickupsData {
  items: Record<string, PickupItem>;
  nextId: number;
  rngState: number;
  spawnProgress: Record<string, number>;
}

/** UI view model: the item plus its elapsed-lifetime fraction (0 fresh -> 1 expiring). */
export type PickupView = PickupItem & {
  lifetimeFraction?: number;
};

export interface PickupsOptions<T extends object> {
  definitions: readonly PickupDef<T>[];
  /** Read the live pickups sub-state. */
  getData(state: T): PickupsData;
  /** Replace the pickups sub-state (reassign for reactivity). */
  setData(state: T, data: PickupsData): void;
  /** Notified after an item spawned (manual or automatic). */
  onSpawn?(state: T, item: PickupItem): void;
  /** Notified when an item expired (never on `take`). */
  onExpire?(state: T, item: PickupItem): void;
}

/** Answer to "can this item be acted on right now, and if not, why?". */
export type PickupStatus =
  | { kind: "ready"; item: PickupItem }
  | { kind: "unknown" }
  | { kind: "expired" };

export interface PickupsExtension<T extends object> extends Extension<T> {
  /**
   * Manually spawn one item of `type` (mission scripts, producer output,
   * debug tools). Returns `undefined` for an unknown type. Spawning never
   * grants anything: rewards happen when the item is successfully taken.
   */
  spawn(
    state: T,
    type: string,
    options?: {
      position?: PickupPosition;
      metadata?: Record<string, unknown>;
      lifetime?: number;
    },
  ): PickupItem | undefined;

  status(state: T, id: string): PickupStatus;
  /**
   * Remove and return the item — the settlement primitive for collect
   * actions. Returns `undefined` (removing nothing) unless the item is ready.
   */
  take(state: T, id: string): PickupItem | undefined;
  /** View models of every active item, for rendering. */
  visible(state: T): PickupView[];
  /** Count of active items (of one type, or all). */
  active(state: T, type?: string): number;
}
