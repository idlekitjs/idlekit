import type { Extension } from "@idlekitjs/types";

/**
 * Mechanic-only definition of a container: a finite-capacity holder of
 * multiple content types. Presentation (name, icon) stays on the game side,
 * optionally carried through `metadata`.
 */
export interface ContainerDef<T extends object> {
  /** Unique, stable identifier. */
  id: string;
  /** Total capacity in volume units (finite > 0), static or state-derived. */
  capacity: number | ((state: T) => number);
  /**
   * Volume occupied by one unit of a content type (default 1). Lets amounts
   * and occupied space differ: 3 units of a volume-2 content use 6 capacity.
   */
  volumeOf?: (contentId: string, state: T) => number;
  /** Free-form data for the game (name, icon, ...). */
  metadata?: Record<string, unknown>;
}

/** Amounts per content id. Entries are always > 0; empty means empty. */
export type ContainerContents = Record<string, number>;

/**
 * Serializable containers sub-state: contents keyed by container id. Lives
 * under one key of the game state; reassigned wholesale on change (reactivity).
 */
export type ContainersData = Record<string, ContainerContents>;

export interface ContainersOptions<T extends object> {
  definitions: readonly ContainerDef<T>[];
  /** Read the live containers sub-state. */
  getData(state: T): ContainersData;
  /** Replace the containers sub-state (reassign for reactivity). */
  setData(state: T, data: ContainersData): void;
}

export interface DrainInput {
  /** Restrict the drain to one content type (default: every type). */
  contentId?: string;
  /** Max amount to remove (only meaningful with `contentId`; default: all). */
  amount?: number;
}

export interface DrainResult {
  /** What actually left the container, per content type. */
  removed: ContainerContents;
  /** Contents after the drain. */
  remaining: ContainerContents;
}

export interface ContainersExtension<T extends object> extends Extension<T> {
  /** Occupied capacity: `sum(amount * volumeOf(contentId))`. 0 for unknown ids. */
  used(state: T, containerId: string): number;
  /** `capacity - used`. Can be negative if a dynamic capacity shrank. */
  free(state: T, containerId: string): number;
  /** Current capacity (0 for unknown ids). */
  capacity(state: T, containerId: string): number;
  /** Snapshot of the contents ({} for unknown ids). */
  contents(state: T, containerId: string): ContainerContents;

  /** Whether `amount` (default 1) of `contentId` fits right now. */
  canFit(state: T, containerId: string, contentId: string, amount?: number): boolean;
  /**
   * All-or-nothing fill: add `amount` (default 1) of `contentId`, or return
   * `false` without mutating when it does not fit (or the container/amount is
   * invalid).
   */
  fill(state: T, containerId: string, contentId: string, amount?: number): boolean;
  /** Fill what fits, up to `amount`. Returns the accepted amount (0 on misuse). */
  fillUpTo(state: T, containerId: string, contentId: string, amount: number): number;

  /**
   * Remove content. No input = drain everything; `{ contentId }` = all of one
   * type; `{ contentId, amount }` = up to `amount` of one type.
   */
  drain(state: T, containerId: string, input?: DrainInput): DrainResult;
}
