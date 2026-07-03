import type { Modifier } from "../modifiers";
import type { ActiveBoost, BoostDef, BoostsExtension, BoostsOptions } from "./types";

/** Wiring-time validation: a bad definition is a bug, not a game state. */
function validateDefinitions(definitions: BoostDef[]): void {
  const ids = new Set<string>();
  for (const def of definitions) {
    if (ids.has(def.id)) {
      throw new Error(`boosts: duplicate boost id "${def.id}".`);
    }
    ids.add(def.id);
    if (!Number.isFinite(def.duration) || def.duration <= 0) {
      throw new Error(
        `boosts: boost "${def.id}" needs a finite duration > 0 (got ${def.duration}).`,
      );
    }
    if (def.maxDuration !== undefined) {
      if (!Number.isFinite(def.maxDuration) || def.maxDuration < def.duration) {
        throw new Error(
          `boosts: boost "${def.id}" needs maxDuration >= duration (got ${def.maxDuration}).`,
        );
      }
    }
    if (def.maxStacks !== undefined) {
      if (!Number.isInteger(def.maxStacks) || def.maxStacks < 1) {
        throw new Error(
          `boosts: boost "${def.id}" needs an integer maxStacks >= 1 (got ${def.maxStacks}).`,
        );
      }
    }
  }
}

/** Effect resolved at `stacks`: `add` scales linearly, `mult` compounds. */
function stackedEffect(effect: Modifier, stacks: number): Modifier {
  if (stacks === 1) {
    return effect;
  }
  return {
    ...effect,
    value: effect.op === "add" ? effect.value * stacks : Math.pow(effect.value, stacks),
  };
}

/**
 * Boosts: temporary, stackable effects. A boost is granted, stays active while
 * its timer runs, and expires cleanly. While active, its `effects` are
 * published to the (optional) {@link ModifierRegistry} under the source
 * `boost:<id>` — the exact pattern `collections` uses — so consumers such as
 * `producers` pick them up without knowing boosts exist. On expiry or removal
 * the source is retracted: no modifier can leak.
 *
 * The active entries are plain data in the game state, so saving works for
 * free; `setup` republishes the modifiers on `loaded`, and a large `dt`
 * (offline catch-up) expires every due boost in one `update` pass.
 */
export function boosts<T extends object>(options: BoostsOptions<T>): BoostsExtension<T> {
  validateDefinitions(options.definitions);

  const defsById = new Map(options.definitions.map((def) => [def.id, def]));
  const sourceOf = (id: string): string => `boost:${id}`;

  function publish(def: BoostDef, entry: ActiveBoost | undefined): void {
    if (!options.registry) {
      return;
    }
    if (entry && def.effects?.length) {
      options.registry.set(
        sourceOf(def.id),
        def.effects.map((effect) => stackedEffect(effect, entry.stacks)),
      );
    } else {
      options.registry.remove(sourceOf(def.id));
    }
  }

  function setEntry(state: T, entry: ActiveBoost): void {
    options.setActive(state, { ...options.getActive(state), [entry.id]: entry });
  }

  function deleteEntries(state: T, ids: readonly string[]): void {
    const active = { ...options.getActive(state) };
    for (const id of ids) {
      delete active[id];
    }
    options.setActive(state, active);
  }

  function expire(state: T, ids: readonly string[]): void {
    deleteEntries(state, ids);
    for (const id of ids) {
      const def = defsById.get(id);
      if (def) {
        publish(def, undefined);
      }
      options.onExpire?.(id, state);
    }
  }

  function grant(state: T, id: string): ActiveBoost {
    const def = defsById.get(id);
    if (!def) {
      throw new Error(`boosts.grant: unknown boost "${id}".`);
    }
    const cap = def.maxDuration ?? Infinity;
    const current = options.getActive(state)[id];

    let entry: ActiveBoost;
    if (!current) {
      entry = { id, remaining: Math.min(def.duration, cap), stacks: 1 };
    } else {
      switch (def.stacking ?? "refresh") {
        case "refresh":
          entry = { ...current, remaining: Math.min(def.duration, cap) };
          break;
        case "extend":
          entry = { ...current, remaining: Math.min(current.remaining + def.duration, cap) };
          break;
        case "stack":
          entry = {
            ...current,
            stacks: Math.min(current.stacks + 1, def.maxStacks ?? Infinity),
            remaining: Math.min(def.duration, cap),
          };
          break;
      }
    }

    setEntry(state, entry);
    publish(def, entry);
    options.onGrant?.(entry, state);
    return entry;
  }

  function extend(state: T, id: string, seconds: number): boolean {
    const current = options.getActive(state)[id];
    const def = defsById.get(id);
    if (!current || !def) {
      return false;
    }
    const remaining = Math.min(current.remaining + seconds, def.maxDuration ?? Infinity);
    if (remaining <= 0) {
      expire(state, [id]);
      return true;
    }
    setEntry(state, { ...current, remaining });
    return true;
  }

  function remove(state: T, id: string): boolean {
    if (!options.getActive(state)[id]) {
      return false;
    }
    deleteEntries(state, [id]);
    const def = defsById.get(id);
    if (def) {
      publish(def, undefined);
    }
    return true;
  }

  /** Publish/retract every known boost's effects from the current state. */
  function rebuildModifiers(state: T): void {
    const active = options.getActive(state);
    for (const def of options.definitions) {
      publish(def, active[def.id]);
    }
  }

  /**
   * Heal a loaded save: drop unknown boost ids, clamp `remaining` and `stacks`
   * against the current definitions.
   */
  function sanitize(state: T): void {
    const active = options.getActive(state);
    const sane: Record<string, ActiveBoost> = {};
    let changed = false;

    for (const entry of Object.values(active)) {
      const def = defsById.get(entry.id);
      if (!def || !Number.isFinite(entry.remaining) || entry.remaining <= 0) {
        changed = true;
        continue;
      }
      const remaining = Math.min(entry.remaining, def.maxDuration ?? Infinity);
      const stacks = Math.min(
        Math.max(1, Math.floor(entry.stacks ?? 1)),
        def.maxStacks ?? Infinity,
      );
      if (remaining !== entry.remaining || stacks !== entry.stacks) {
        changed = true;
      }
      sane[entry.id] = { id: entry.id, remaining, stacks };
    }

    if (changed) {
      options.setActive(state, sane);
    }
  }

  return {
    id: "boosts",

    setup(engine) {
      engine.events.on("loaded", () => {
        sanitize(engine.state);
        rebuildModifiers(engine.state);
      });
    },

    update(state, dt) {
      const active = options.getActive(state);
      let expired: string[] | null = null;
      for (const entry of Object.values(active)) {
        // Mutated in place: no render depends on the countdown itself.
        entry.remaining -= dt;
        if (entry.remaining <= 0) {
          (expired ??= []).push(entry.id);
        }
      }
      if (expired) {
        expire(state, expired);
      }
    },

    grant,
    extend,
    remove,

    isActive(state, id) {
      return options.getActive(state)[id] !== undefined;
    },
    get(state, id) {
      return options.getActive(state)[id];
    },
    active(state) {
      return Object.values(options.getActive(state));
    },
    rebuildModifiers,
  };
}
