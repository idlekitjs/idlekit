import type { Extension } from "@idlekitjs/types";

/**
 * Quantities of resources keyed by resource id. The shared currency shape of
 * the crafting mechanic: inputs, outputs and the game's stock all use it.
 */
export type ResourceBag = Record<string, number>;

/**
 * Mechanic-only definition of a recipe. Presentation (name, icon, description)
 * stays on the game side, optionally carried through `metadata`.
 */
export interface RecipeDef {
  /** Unique, stable identifier. */
  id: string;
  /** Resources consumed when a job starts. */
  inputs: ResourceBag;
  /** Resources credited when a job completes. */
  outputs: ResourceBag;
  /** Seconds needed to complete one job (finite, > 0). */
  duration: number;
  /** Machine type required to run this recipe (default: any machine). */
  machineType?: string;
  /** Free-form data for the game (name, icon, ...). */
  metadata?: Record<string, unknown>;
}

/** A machine/station that can run one job at a time. */
export interface MachineDef {
  /** Unique, stable identifier. */
  id: string;
  /** Type matched against {@link RecipeDef.machineType} (default: untyped). */
  type?: string;
  /** Free-form data for the game (name, icon, ...). */
  metadata?: Record<string, unknown>;
}

/**
 * A running job. Plain serializable data stored in the game state via
 * `getJobs/setJobs`; the mechanic holds no runtime-only job state.
 */
export interface CraftingJob {
  /** Unique among active jobs (see {@link CraftingOptions.jobId}). */
  id: string;
  recipeId: string;
  machineId: string;
  /**
   * Seconds accumulated, mutated in place. Render crafting progress bars from a
   * frame callback; reactive bindings are still fine for job lists,
   * availability, completed jobs and resource counts.
   */
  elapsed: number;
  /** Seconds required, copied from the recipe when the job starts. */
  duration: number;
}

/**
 * Answer to "can `recipeId` run on `machineId`, and if not, why?". Directly
 * consumable by a game UI (tooltip, disabled button, missing-resource list).
 */
export type CraftingStatus =
  | { kind: "ready" }
  | { kind: "unknown-recipe" }
  | { kind: "unknown-machine" }
  | { kind: "wrong-machine-type"; required: string; actual?: string }
  /** The machine is running a *different* recipe. */
  | { kind: "machine-busy"; jobId: string }
  | { kind: "missing-inputs"; missing: ResourceBag }
  /** The machine is running *this* recipe. `progress` is in `[0, 1]`. */
  | { kind: "crafting"; job: CraftingJob; progress: number };

export interface CraftingOptions<T extends object> {
  recipes: RecipeDef[];
  machines: MachineDef[];
  /** Read the live resource stock from the state. */
  getResources: (state: T) => ResourceBag;
  /** Reassign the resource stock into the state (keeps reactivity). */
  setResources: (state: T, resources: ResourceBag) => void;
  /** Read the live active jobs from the state. */
  getJobs: (state: T) => CraftingJob[];
  /** Reassign the active jobs into the state (keeps reactivity). */
  setJobs: (state: T, jobs: CraftingJob[]) => void;
  /**
   * Job id factory (default: `"<machineId>:<recipeId>"`, unique since a
   * machine runs at most one job).
   */
  jobId?: (recipe: RecipeDef, machine: MachineDef, state: T) => string;
  /** Notified after a job started (inputs already consumed). */
  onStart?: (job: CraftingJob, state: T) => void;
  /** Notified after a job completed (outputs already credited). */
  onComplete?: (job: CraftingJob, outputs: ResourceBag, state: T) => void;
}

export interface CraftingExtension<T extends object> extends Extension<T> {
  /** Why `recipeId` can/cannot run on `machineId` right now. */
  status(state: T, recipeId: string, machineId: string): CraftingStatus;
  /** Shorthand for `status(...).kind === "ready"`. */
  canStart(state: T, recipeId: string, machineId: string): boolean;
  /**
   * Try to start a job: consume the inputs and create the job. Returns the
   * `"crafting"` status on success, or the blocking status otherwise.
   */
  start(state: T, recipeId: string, machineId: string): CraftingStatus;
  /**
   * Cancel the machine's active job. Inputs are refunded unless
   * `refund: false`. Returns `false` when the machine is idle.
   */
  cancel(state: T, machineId: string, options?: { refund?: boolean }): boolean;
  /** Snapshot of every running job. */
  activeJobs(state: T): CraftingJob[];
  /** The machine's active job, if any. */
  jobFor(state: T, machineId: string): CraftingJob | undefined;
  /**
   * Progress of the machine's active job in `[0, 1]` (0 when idle). This can
   * change continuously from in-place job state, so use a frame callback for
   * smooth bars/countdowns.
   */
  progressFraction(state: T, machineId: string): number;
}
