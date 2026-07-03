import { Random } from "@idlekitjs/core";
import { clamp } from "@idlekitjs/utils";
import type {
  PickupDef,
  PickupItem,
  PickupPosition,
  PickupsData,
  PickupsExtension,
  PickupsOptions,
  PickupView,
} from "./types";

/** Fresh pickups sub-state for a new game (time-based seed unless given). */
export function createPickupsData(seed?: number): PickupsData {
  return {
    items: {},
    nextId: 1,
    rngState: seed ?? (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0,
    spawnProgress: {},
  };
}

/** Wiring-time validation: a bad definition is a bug, not a game state. */
function validateDefinitions<T extends object>(definitions: readonly PickupDef<T>[]): void {
  const ids = new Set<string>();
  for (const def of definitions) {
    if (ids.has(def.id)) {
      throw new Error(`pickups: duplicate pickup type "${def.id}".`);
    }
    ids.add(def.id);
    if (def.lifetime !== undefined && (!Number.isFinite(def.lifetime) || def.lifetime <= 0)) {
      throw new Error(
        `pickups: type "${def.id}" needs a finite lifetime > 0 (got ${def.lifetime}).`,
      );
    }
    const spawn = def.spawn;
    if (!spawn) {
      continue;
    }
    if (!Number.isFinite(spawn.every) || spawn.every <= 0) {
      throw new Error(
        `pickups: type "${def.id}" needs a finite spawn.every > 0 (got ${spawn.every}).`,
      );
    }
    if (spawn.max !== undefined && (!Number.isInteger(spawn.max) || spawn.max < 1)) {
      throw new Error(
        `pickups: type "${def.id}" needs an integer spawn.max >= 1 (got ${spawn.max}).`,
      );
    }
    if (def.lifetime === undefined && spawn.max === undefined) {
      // Bounds the offline catch-up: without either, hours away would spawn
      // an unbounded number of immortal items.
      throw new Error(
        `pickups: auto-spawned type "${def.id}" must declare a lifetime and/or spawn.max.`,
      );
    }
  }
}

/** An item is active while it has no countdown or its countdown is positive. */
function isActive(item: PickupItem): boolean {
  return item.remaining === undefined || item.remaining > 0;
}

/**
 * Pickups: temporary, individually identifiable items the player can collect
 * before they expire — golden bonuses, dropped loot, litter on a map. The
 * mechanic owns spawning (scheduled or manual), lifetimes and removal; it
 * never grants rewards (settle collects through a transaction whose `apply`
 * calls `take`), never touches capacity, and never renders.
 *
 * Offline catch-up is deterministic and bounded: a large `dt` first expires
 * due items, then spawns only what would still be alive — at most
 * `floor(lifetime / every) + 1` back-spawns per type, staggered so their
 * countdowns reflect when they would have appeared, and never above
 * `spawn.max`.
 */
export function pickups<T extends object>(options: PickupsOptions<T>): PickupsExtension<T> {
  validateDefinitions(options.definitions);
  const defs = new Map(options.definitions.map((def) => [def.id, def]));

  function activeCount(state: T, type?: string): number {
    let count = 0;
    for (const item of Object.values(options.getData(state).items)) {
      if ((type === undefined || item.type === type) && isActive(item)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Create one item and persist it (items reassigned; nextId/rngState carried
   * in the same write). `age` back-dates the countdown for offline catch-up.
   */
  function spawnItem(
    state: T,
    def: PickupDef<T>,
    overrides: { position?: PickupPosition; metadata?: Record<string, unknown>; lifetime?: number },
    age = 0,
  ): PickupItem | undefined {
    const data = options.getData(state);
    const rng = new Random(data.rngState);
    const lifetime = overrides.lifetime ?? def.lifetime;
    const remaining = lifetime === undefined ? undefined : lifetime - age;
    if (remaining !== undefined && remaining <= 0) {
      return undefined;
    }
    const position = overrides.position ?? def.position?.(state, () => rng.next());
    const metadata =
      def.metadata || overrides.metadata ? { ...def.metadata, ...overrides.metadata } : undefined;

    const item: PickupItem = {
      id: `${def.id}#${data.nextId}`,
      type: def.id,
      ...(remaining !== undefined ? { remaining, lifetime } : {}),
      ...(position ? { position } : {}),
      ...(metadata ? { metadata } : {}),
    };
    options.setData(state, {
      ...data,
      items: { ...data.items, [item.id]: item },
      nextId: data.nextId + 1,
      rngState: rng.state,
    });
    options.onSpawn?.(state, item);
    return item;
  }

  return {
    id: "pickups",

    update(state, dt) {
      // 1. Countdown and expiry sweep. `remaining` is mutated in place; the
      // items record is reassigned only when something actually expired.
      const data = options.getData(state);
      let expired: PickupItem[] | null = null;
      for (const item of Object.values(data.items)) {
        if (item.remaining === undefined) {
          continue;
        }
        item.remaining -= dt;
        if (item.remaining <= 0) {
          (expired ??= []).push(item);
        }
      }
      if (expired) {
        const items = { ...data.items };
        for (const item of expired) {
          delete items[item.id];
        }
        options.setData(state, { ...options.getData(state), items });
        for (const item of expired) {
          options.onExpire?.(state, item);
        }
      }

      // 2. Scheduled spawning. While ineligible (`when` false), no time
      // accumulates — eligibility flipping back on never dumps a burst.
      for (const def of defs.values()) {
        const spawn = def.spawn;
        if (!spawn || (spawn.when && !spawn.when(state))) {
          continue;
        }
        const progress = options.getData(state).spawnProgress;
        progress[def.id] = (progress[def.id] ?? 0) + dt;
        const backlog = Math.floor(progress[def.id] / spawn.every);
        if (backlog <= 0) {
          continue;
        }
        progress[def.id] -= backlog * spawn.every;

        // Offline shaping: only back-spawns that would still be alive count,
        // and the type's cap always holds.
        const survivors =
          def.lifetime === undefined
            ? backlog
            : Math.min(backlog, Math.floor(def.lifetime / spawn.every) + 1);
        const room =
          spawn.max === undefined ? Infinity : Math.max(0, spawn.max - activeCount(state, def.id));
        const count = Math.min(survivors, room);
        // Oldest first, so ids stay chronological and countdowns are staggered.
        for (let i = count - 1; i >= 0; i--) {
          spawnItem(state, def, {}, i * spawn.every);
        }
      }
    },

    spawn(state, type, overrides = {}) {
      const def = defs.get(type);
      if (!def) {
        return undefined;
      }
      return spawnItem(state, def, overrides);
    },

    status(state, id) {
      const item = options.getData(state).items[id];
      if (!item) {
        return { kind: "unknown" };
      }
      if (!isActive(item)) {
        return { kind: "expired" };
      }
      return { kind: "ready", item };
    },

    take(state, id) {
      const data = options.getData(state);
      const item = data.items[id];
      if (!item || !isActive(item)) {
        return undefined;
      }
      const items = { ...data.items };
      delete items[id];
      options.setData(state, { ...data, items });
      return item;
    },

    visible(state) {
      const views: PickupView[] = [];
      for (const item of Object.values(options.getData(state).items)) {
        if (!isActive(item)) {
          continue;
        }
        views.push({
          ...item,
          ...(item.lifetime !== undefined && item.remaining !== undefined
            ? { lifetimeFraction: clamp(1 - item.remaining / item.lifetime, 0, 1) }
            : {}),
        });
      }
      return views;
    },

    active(state, type) {
      return activeCount(state, type);
    },
  };
}
