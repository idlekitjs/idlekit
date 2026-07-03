import { clamp } from "@idlekitjs/utils";
import type { TimerDef, TimersData, TimersExtension, TimersOptions, TimerState } from "./types";

/** Wiring-time validation: a bad definition is a bug, not a game state. */
function validateDefinitions(definitions: readonly TimerDef[]): void {
  const ids = new Set<string>();
  for (const def of definitions) {
    if (ids.has(def.id)) {
      throw new Error(`timers: duplicate timer id "${def.id}".`);
    }
    ids.add(def.id);
    if (!Number.isFinite(def.every) || def.every <= 0) {
      throw new Error(`timers: timer "${def.id}" needs a finite every > 0 (got ${def.every}).`);
    }
  }
}

/**
 * Timers: generic recurring triggers. The mechanic owns the scheduling
 * (period, start/stop, manual trigger, offline catch-up); the effect stays in
 * the game's `onFire` callback. It is not a replacement for producers (which
 * own production math) or boosts (which own timed effects) — it is the small
 * primitive for "every N seconds, do something": drain a container, run a
 * patrol, refresh a shop.
 *
 * Offline is handled by counting: a large `dt` covering several periods calls
 * `onFire(id, state, fires)` once with the number of missed firings, so the
 * game can settle them in one pass.
 */
export function timers<T extends object>(options: TimersOptions<T>): TimersExtension<T> {
  validateDefinitions(options.definitions);
  const defs = new Map(options.definitions.map((def) => [def.id, def]));

  function defaultEntry(def: TimerDef): TimerState {
    return { remaining: def.every, running: def.autoStart ?? true };
  }

  function entryOf(state: T, def: TimerDef): TimerState {
    return options.getData(state)[def.id] ?? defaultEntry(def);
  }

  function writeEntry(state: T, id: string, entry: TimerState): void {
    options.setData(state, { ...options.getData(state), [id]: entry });
  }

  return {
    id: "timers",

    update(state, dt) {
      // Materialize missing entries once, so `remaining` can then be mutated
      // in place (fresh saves and defs added after a save both heal here).
      const data = options.getData(state);
      let materialized: TimersData | null = null;
      for (const def of defs.values()) {
        if (!data[def.id]) {
          materialized ??= { ...data };
          materialized[def.id] = defaultEntry(def);
        }
      }
      if (materialized) {
        options.setData(state, materialized);
      }

      const entries = options.getData(state);
      for (const def of defs.values()) {
        const entry = entries[def.id];
        if (!entry.running) {
          continue;
        }
        entry.remaining -= dt;
        if (entry.remaining > 0) {
          continue;
        }
        const fires = 1 + Math.floor(-entry.remaining / def.every);
        entry.remaining += fires * def.every;
        options.onFire?.(def.id, state, fires);
      }
    },

    start(state, id) {
      const def = defs.get(id);
      if (!def) {
        return false;
      }
      const entry = entryOf(state, def);
      if (!entry.running) {
        writeEntry(state, id, { ...entry, running: true });
      }
      return true;
    },

    stop(state, id) {
      const def = defs.get(id);
      if (!def) {
        return false;
      }
      const entry = entryOf(state, def);
      if (entry.running) {
        writeEntry(state, id, { ...entry, running: false });
      }
      return true;
    },

    isRunning(state, id) {
      const def = defs.get(id);
      return def ? entryOf(state, def).running : false;
    },

    trigger(state, id) {
      const def = defs.get(id);
      if (!def) {
        return false;
      }
      const entry = entryOf(state, def);
      writeEntry(state, id, { ...entry, remaining: def.every });
      options.onFire?.(id, state, 1);
      return true;
    },

    progressFraction(state, id) {
      const def = defs.get(id);
      if (!def) {
        return 0;
      }
      return clamp(1 - entryOf(state, def).remaining / def.every, 0, 1);
    },
  };
}
