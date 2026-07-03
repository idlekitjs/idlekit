import type {
  ContainerContents,
  ContainerDef,
  ContainersExtension,
  ContainersOptions,
  DrainInput,
  DrainResult,
} from "./types";

/** Wiring-time validation: a bad definition is a bug, not a game state. */
function validateDefinitions<T extends object>(definitions: readonly ContainerDef<T>[]): void {
  const ids = new Set<string>();
  for (const def of definitions) {
    if (ids.has(def.id)) {
      throw new Error(`containers: duplicate container id "${def.id}".`);
    }
    ids.add(def.id);
    if (typeof def.capacity === "number" && (!Number.isFinite(def.capacity) || def.capacity <= 0)) {
      throw new Error(
        `containers: container "${def.id}" needs a finite capacity > 0 (got ${def.capacity}).`,
      );
    }
  }
}

/**
 * Containers: finite capacity holding multiple content types. The mechanic
 * owns the capacity math (fit checks, all-or-nothing fills, partial drains);
 * what fills or empties a container — player actions, timers, other mechanics
 * — stays on the game side. No periodic logic runs here.
 *
 * User-facing operations are misuse-safe: an unknown container id reads as
 * empty with zero capacity, fills fail and drains remove nothing. Static
 * definition mistakes (duplicate ids, invalid capacities) throw at wiring
 * time; a dynamic `capacity`/`volumeOf` returning an invalid number throws at
 * call time, as the programming error it is.
 */
export function containers<T extends object>(
  options: ContainersOptions<T>,
): ContainersExtension<T> {
  validateDefinitions(options.definitions);
  const defs = new Map(options.definitions.map((def) => [def.id, def]));

  function capacityOf(state: T, def: ContainerDef<T>): number {
    const capacity = typeof def.capacity === "function" ? def.capacity(state) : def.capacity;
    if (!Number.isFinite(capacity) || capacity <= 0) {
      throw new Error(
        `containers: container "${def.id}" resolved an invalid capacity (${capacity}).`,
      );
    }
    return capacity;
  }

  function volumeOf(state: T, def: ContainerDef<T>, contentId: string): number {
    const volume = def.volumeOf?.(contentId, state) ?? 1;
    if (!Number.isFinite(volume) || volume < 0) {
      throw new Error(
        `containers: container "${def.id}" resolved an invalid volume for "${contentId}" (${volume}).`,
      );
    }
    return volume;
  }

  function contentsOf(state: T, containerId: string): ContainerContents {
    return options.getData(state)[containerId] ?? {};
  }

  function usedOf(state: T, def: ContainerDef<T>): number {
    let used = 0;
    for (const [contentId, amount] of Object.entries(contentsOf(state, def.id))) {
      used += amount * volumeOf(state, def, contentId);
    }
    return used;
  }

  /** Reassign one container's contents, dropping empty entries. */
  function writeContents(state: T, containerId: string, contents: ContainerContents): void {
    const cleaned: ContainerContents = {};
    for (const [contentId, amount] of Object.entries(contents)) {
      if (amount > 0) {
        cleaned[contentId] = amount;
      }
    }
    options.setData(state, { ...options.getData(state), [containerId]: cleaned });
  }

  function acceptable(state: T, def: ContainerDef<T>, contentId: string, amount: number): number {
    if (!Number.isFinite(amount) || amount <= 0) {
      return 0;
    }
    const volume = volumeOf(state, def, contentId);
    if (volume === 0) {
      return amount;
    }
    const free = capacityOf(state, def) - usedOf(state, def);
    return Math.max(0, Math.min(amount, free / volume));
  }

  function drain(state: T, containerId: string, input: DrainInput = {}): DrainResult {
    const contents = contentsOf(state, containerId);
    if (!defs.has(containerId)) {
      return { removed: {}, remaining: {} };
    }

    const removed: ContainerContents = {};
    const remaining: ContainerContents = { ...contents };
    if (input.contentId === undefined) {
      // Full drain; `amount` is only meaningful for a single content type.
      for (const [contentId, amount] of Object.entries(contents)) {
        removed[contentId] = amount;
        delete remaining[contentId];
      }
    } else {
      const available = contents[input.contentId] ?? 0;
      const wanted = input.amount ?? available;
      const taken = Number.isFinite(wanted) ? Math.max(0, Math.min(wanted, available)) : 0;
      if (taken > 0) {
        removed[input.contentId] = taken;
        remaining[input.contentId] = available - taken;
      }
    }

    if (Object.keys(removed).length > 0) {
      writeContents(state, containerId, remaining);
    }
    // Report post-write contents (zero entries dropped).
    return { removed, remaining: contentsOf(state, containerId) };
  }

  return {
    id: "containers",

    used(state, containerId) {
      const def = defs.get(containerId);
      return def ? usedOf(state, def) : 0;
    },

    free(state, containerId) {
      const def = defs.get(containerId);
      return def ? capacityOf(state, def) - usedOf(state, def) : 0;
    },

    capacity(state, containerId) {
      const def = defs.get(containerId);
      return def ? capacityOf(state, def) : 0;
    },

    contents(state, containerId) {
      return { ...contentsOf(state, containerId) };
    },

    canFit(state, containerId, contentId, amount = 1) {
      const def = defs.get(containerId);
      if (!def || !Number.isFinite(amount) || amount <= 0) {
        return false;
      }
      return acceptable(state, def, contentId, amount) >= amount;
    },

    fill(state, containerId, contentId, amount = 1) {
      const def = defs.get(containerId);
      if (!def || !Number.isFinite(amount) || amount <= 0) {
        return false;
      }
      if (acceptable(state, def, contentId, amount) < amount) {
        return false;
      }
      const contents = contentsOf(state, containerId);
      writeContents(state, containerId, {
        ...contents,
        [contentId]: (contents[contentId] ?? 0) + amount,
      });
      return true;
    },

    fillUpTo(state, containerId, contentId, amount) {
      const def = defs.get(containerId);
      if (!def) {
        return 0;
      }
      const accepted = acceptable(state, def, contentId, amount);
      if (accepted <= 0) {
        return 0;
      }
      const contents = contentsOf(state, containerId);
      writeContents(state, containerId, {
        ...contents,
        [contentId]: (contents[contentId] ?? 0) + accepted,
      });
      return accepted;
    },

    drain,
  };
}
