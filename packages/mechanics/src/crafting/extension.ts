import { clamp } from "@idlekitjs/utils";
import { addResources, canAfford, missingResources, subtractResources } from "./resources";
import type {
  CraftingExtension,
  CraftingJob,
  CraftingOptions,
  CraftingStatus,
  MachineDef,
  RecipeDef,
  ResourceBag,
} from "./types";

/** Wiring-time validation: a bad definition is a bug, not a game state. */
function validateDefinitions(recipes: RecipeDef[], machines: MachineDef[]): void {
  const recipeIds = new Set<string>();
  for (const recipe of recipes) {
    if (recipeIds.has(recipe.id)) {
      throw new Error(`crafting: duplicate recipe id "${recipe.id}".`);
    }
    recipeIds.add(recipe.id);
    if (!Number.isFinite(recipe.duration) || recipe.duration <= 0) {
      throw new Error(
        `crafting: recipe "${recipe.id}" needs a finite duration > 0 (got ${recipe.duration}).`,
      );
    }
    for (const [bagName, bag] of [
      ["inputs", recipe.inputs],
      ["outputs", recipe.outputs],
    ] as const) {
      for (const [id, amount] of Object.entries(bag)) {
        if (!Number.isFinite(amount) || amount < 0) {
          throw new Error(
            `crafting: recipe "${recipe.id}" has an invalid ${bagName} amount for "${id}" (got ${amount}).`,
          );
        }
      }
    }
  }

  const machineIds = new Set<string>();
  for (const machine of machines) {
    if (machineIds.has(machine.id)) {
      throw new Error(`crafting: duplicate machine id "${machine.id}".`);
    }
    machineIds.add(machine.id);
  }
}

/**
 * Crafting: timed transformation of resources (`inputs -> job -> duration ->
 * outputs`) across machines/stations. The mechanic (job lifecycle, input
 * consumption, output crediting) lives here; recipes and machines stay as data
 * in the game.
 *
 * Model: one active job per machine, no queue. Inputs are consumed when the
 * job starts; outputs are credited when it completes. Jobs are plain data in
 * the game state, so saving works for free, and a large `dt` (offline catch-up
 * via `engine.advance`) completes every due job in one `update` pass.
 */
export function crafting<T extends object>(options: CraftingOptions<T>): CraftingExtension<T> {
  validateDefinitions(options.recipes, options.machines);

  const recipesById = new Map(options.recipes.map((recipe) => [recipe.id, recipe]));
  const machinesById = new Map(options.machines.map((machine) => [machine.id, machine]));

  const defaultJobId = (recipe: RecipeDef, machine: MachineDef): string =>
    `${machine.id}:${recipe.id}`;

  const jobFor = (state: T, machineId: string): CraftingJob | undefined =>
    options.getJobs(state).find((job) => job.machineId === machineId);

  function status(state: T, recipeId: string, machineId: string): CraftingStatus {
    const recipe = recipesById.get(recipeId);
    if (!recipe) {
      return { kind: "unknown-recipe" };
    }
    const machine = machinesById.get(machineId);
    if (!machine) {
      return { kind: "unknown-machine" };
    }

    const job = jobFor(state, machineId);
    if (job) {
      return job.recipeId === recipeId
        ? { kind: "crafting", job, progress: clamp(job.elapsed / job.duration, 0, 1) }
        : { kind: "machine-busy", jobId: job.id };
    }

    if (recipe.machineType !== undefined && recipe.machineType !== machine.type) {
      return { kind: "wrong-machine-type", required: recipe.machineType, actual: machine.type };
    }

    const resources = options.getResources(state);
    if (!canAfford(resources, recipe.inputs)) {
      return { kind: "missing-inputs", missing: missingResources(resources, recipe.inputs) };
    }

    return { kind: "ready" };
  }

  function start(state: T, recipeId: string, machineId: string): CraftingStatus {
    const check = status(state, recipeId, machineId);
    if (check.kind !== "ready") {
      return check;
    }

    // `ready` implies both lookups succeed.
    const recipe = recipesById.get(recipeId) as RecipeDef;
    const machine = machinesById.get(machineId) as MachineDef;

    options.setResources(state, subtractResources(options.getResources(state), recipe.inputs));

    const job: CraftingJob = {
      id: (options.jobId ?? defaultJobId)(recipe, machine, state),
      recipeId,
      machineId,
      elapsed: 0,
      duration: recipe.duration,
    };
    options.setJobs(state, [...options.getJobs(state), job]);
    options.onStart?.(job, state);
    return { kind: "crafting", job, progress: 0 };
  }

  function cancel(state: T, machineId: string, cancelOptions?: { refund?: boolean }): boolean {
    const job = jobFor(state, machineId);
    if (!job) {
      return false;
    }
    options.setJobs(
      state,
      options.getJobs(state).filter((candidate) => candidate !== job),
    );

    const recipe = recipesById.get(job.recipeId);
    if ((cancelOptions?.refund ?? true) && recipe) {
      options.setResources(state, addResources(options.getResources(state), recipe.inputs));
    }
    return true;
  }

  function completeDueJobs(state: T): void {
    const jobs = options.getJobs(state);
    const completed = jobs.filter((job) => job.elapsed >= job.duration);
    if (completed.length === 0) {
      return;
    }

    options.setJobs(
      state,
      jobs.filter((job) => job.elapsed < job.duration),
    );

    let credited: ResourceBag = options.getResources(state);
    for (const job of completed) {
      const recipe = recipesById.get(job.recipeId);
      if (recipe) {
        credited = addResources(credited, recipe.outputs);
      }
    }
    options.setResources(state, credited);

    for (const job of completed) {
      const recipe = recipesById.get(job.recipeId);
      options.onComplete?.(job, recipe ? { ...recipe.outputs } : {}, state);
    }
  }

  /**
   * Drop jobs whose recipe/machine no longer exists (or duplicated machines)
   * and re-derive `duration` from the current recipe, so a stale save heals
   * against updated definitions instead of misbehaving.
   */
  function sanitizeJobs(state: T): void {
    const jobs = options.getJobs(state);
    const seenMachines = new Set<string>();
    let changed = false;

    const sane = jobs.filter((job) => {
      const recipe = recipesById.get(job.recipeId);
      const valid =
        recipe !== undefined && machinesById.has(job.machineId) && !seenMachines.has(job.machineId);
      if (!valid) {
        changed = true;
        return false;
      }
      seenMachines.add(job.machineId);
      if (job.duration !== recipe.duration) {
        job.duration = recipe.duration;
        changed = true;
      }
      if (!Number.isFinite(job.elapsed) || job.elapsed < 0) {
        job.elapsed = 0;
        changed = true;
      }
      return true;
    });

    if (changed) {
      options.setJobs(state, sane);
    }
  }

  return {
    id: "crafting",

    setup(engine) {
      engine.events.on("loaded", () => sanitizeJobs(engine.state));
    },

    update(state, dt) {
      const jobs = options.getJobs(state);
      if (jobs.length === 0) {
        return;
      }
      for (const job of jobs) {
        // Mutated in place: rendering reads progress via `progressFraction`.
        job.elapsed += dt;
      }
      completeDueJobs(state);
    },

    status,
    canStart(state, recipeId, machineId) {
      return status(state, recipeId, machineId).kind === "ready";
    },
    start,
    cancel,

    activeJobs(state) {
      return [...options.getJobs(state)];
    },
    jobFor,
    progressFraction(state, machineId) {
      const job = jobFor(state, machineId);
      return job ? clamp(job.elapsed / job.duration, 0, 1) : 0;
    },
  };
}
