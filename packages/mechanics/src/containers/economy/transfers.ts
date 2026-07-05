import type { ContainersExtension } from "../types";

/** Amounts per resource/content id. Entries are meaningful only when > 0. */
export type ResourceBag = Record<string, number>;

/**
 * How much of the requested transfer must succeed:
 * - `"all-or-nothing"`: move the full request or nothing (the default);
 * - `"partial"`: move as much as source and space allow.
 */
export type TransferMode = "all-or-nothing" | "partial";

/** Why a transfer moved nothing (only present when `ok` is `false`). */
export type TransferBlock =
  | { kind: "unknown-container"; containerId: string; message: string }
  /** The request resolved to no movable amount (empty request or empty source). */
  | { kind: "empty-request"; message: string }
  /** Source lacked the requested amounts (`missing` = shortfall per id). */
  | { kind: "missing-source"; missing: ResourceBag; message: string }
  /** Container could not hold the request (`missing` = amount that did not fit). */
  | { kind: "insufficient-space"; free: number; missing: ResourceBag; message: string };

/** Outcome of a bag <-> container transfer. */
export interface TransferResult {
  /** Whether anything moved (partial) / the whole request moved (all-or-nothing). */
  ok: boolean;
  /** Amount actually moved per id (empty when nothing moved). */
  moved: ResourceBag;
  /** Container volume added (bag -> container) or removed (container -> bag); always >= 0. */
  movedVolume: number;
  /** Diagnostics when `ok` is `false`. */
  blocked?: TransferBlock;
}

/**
 * Read/write seam for the source or destination resource bag. Mirrors the
 * `getResources`/`setResources` convention: `set` reassigns for reactivity.
 */
export interface BagAccessor<T extends object> {
  get(state: T): ResourceBag;
  set(state: T, bag: ResourceBag): void;
}

export interface TransferOptions {
  /** Transfer mode (default `"all-or-nothing"`). */
  mode?: TransferMode;
}

const EPSILON = 1e-9;

function positiveEntries(bag: ResourceBag | undefined): ResourceBag {
  const out: ResourceBag = {};
  if (!bag) {
    return out;
  }
  for (const [id, amount] of Object.entries(bag)) {
    if (Number.isFinite(amount) && amount > 0) {
      out[id] = amount;
    }
  }
  return out;
}

/** Per-id `max(0, target - available)`, dropping zeros. */
function shortfall(targets: ResourceBag, available: ResourceBag): ResourceBag {
  const out: ResourceBag = {};
  for (const [id, target] of Object.entries(targets)) {
    const gap = target - (available[id] ?? 0);
    if (gap > EPSILON) {
      out[id] = gap;
    }
  }
  return out;
}

function subtractBag(bag: ResourceBag, taken: ResourceBag): ResourceBag {
  const next: ResourceBag = { ...bag };
  for (const [id, amount] of Object.entries(taken)) {
    const remaining = (next[id] ?? 0) - amount;
    if (remaining > EPSILON) {
      next[id] = remaining;
    } else {
      delete next[id];
    }
  }
  return next;
}

/**
 * Resolve what to actually move: `request` (or the whole `available` bag when
 * omitted), capped to what the source can supply in `"partial"` mode.
 */
function resolveDesired(
  request: ResourceBag | undefined,
  available: ResourceBag,
  mode: TransferMode,
): ResourceBag {
  const targets = positiveEntries(request ?? available);
  const desired: ResourceBag = {};
  for (const [id, target] of Object.entries(targets)) {
    const supply = available[id] ?? 0;
    const amount = mode === "partial" ? Math.min(target, supply) : target;
    if (amount > EPSILON) {
      desired[id] = amount;
    }
  }
  return desired;
}

/**
 * Move resources from a bag into a container, composing the container mechanic's
 * own `fillUpTo`/`drain` primitives. `request` names the ids and amounts to move
 * (default: the whole bag). The bag is the source of truth for what is spent; the
 * container stays the source of truth for capacity.
 *
 * - `"all-or-nothing"`: if the source lacks the request, or the container cannot
 *   hold all of it, nothing moves and `blocked` explains why.
 * - `"partial"`: moves as much as the source has and the container can hold.
 */
export function transferBagToContainer<T extends object>(
  containers: ContainersExtension<T>,
  bag: BagAccessor<T>,
  state: T,
  containerId: string,
  request?: ResourceBag,
  options: TransferOptions = {},
): TransferResult {
  const mode = options.mode ?? "all-or-nothing";

  if (containers.capacity(state, containerId) <= 0) {
    return {
      ok: false,
      moved: {},
      movedVolume: 0,
      blocked: {
        kind: "unknown-container",
        containerId,
        message: `Unknown container "${containerId}".`,
      },
    };
  }

  const source = bag.get(state);

  if (mode === "all-or-nothing" && request) {
    const missing = shortfall(positiveEntries(request), source);
    if (Object.keys(missing).length > 0) {
      return {
        ok: false,
        moved: {},
        movedVolume: 0,
        blocked: {
          kind: "missing-source",
          missing,
          message: "Not enough in the source bag to move the full request.",
        },
      };
    }
  }

  const desired = resolveDesired(request, source, mode);
  if (Object.keys(desired).length === 0) {
    return {
      ok: false,
      moved: {},
      movedVolume: 0,
      blocked: { kind: "empty-request", message: "Nothing available to move into the container." },
    };
  }

  const usedBefore = containers.used(state, containerId);
  const moved: ResourceBag = {};
  const notPlaced: ResourceBag = {};
  for (const [id, amount] of Object.entries(desired)) {
    const accepted = containers.fillUpTo(state, containerId, id, amount);
    if (accepted > EPSILON) {
      moved[id] = accepted;
    }
    if (amount - accepted > EPSILON) {
      notPlaced[id] = amount - accepted;
    }
  }

  if (mode === "all-or-nothing" && Object.keys(notPlaced).length > 0) {
    // Roll back the greedy fill so an all-or-nothing block leaves no trace.
    for (const [id, amount] of Object.entries(moved)) {
      containers.drain(state, containerId, { contentId: id, amount });
    }
    return {
      ok: false,
      moved: {},
      movedVolume: 0,
      blocked: {
        kind: "insufficient-space",
        free: containers.free(state, containerId),
        missing: notPlaced,
        message: "Container does not have space for the full transfer.",
      },
    };
  }

  if (Object.keys(moved).length === 0) {
    return {
      ok: false,
      moved: {},
      movedVolume: 0,
      blocked: {
        kind: "insufficient-space",
        free: containers.free(state, containerId),
        missing: notPlaced,
        message: "Container has no room for the transfer.",
      },
    };
  }

  const movedVolume = containers.used(state, containerId) - usedBefore;
  bag.set(state, subtractBag(source, moved));
  return { ok: true, moved, movedVolume };
}

/**
 * Move resources from a container into a bag, composing the container mechanic's
 * `drain` primitive. `request` names the ids and amounts to move (default: the
 * whole container). The bag is unbounded, so the only block is a source shortfall.
 *
 * - `"all-or-nothing"`: if the container holds less than the request, nothing
 *   moves and `blocked` reports the shortfall.
 * - `"partial"`: moves whatever the container holds, up to the request.
 */
export function transferContainerToBag<T extends object>(
  containers: ContainersExtension<T>,
  bag: BagAccessor<T>,
  state: T,
  containerId: string,
  request?: ResourceBag,
  options: TransferOptions = {},
): TransferResult {
  const mode = options.mode ?? "all-or-nothing";

  if (containers.capacity(state, containerId) <= 0) {
    return {
      ok: false,
      moved: {},
      movedVolume: 0,
      blocked: {
        kind: "unknown-container",
        containerId,
        message: `Unknown container "${containerId}".`,
      },
    };
  }

  const contents = containers.contents(state, containerId);

  if (mode === "all-or-nothing" && request) {
    const missing = shortfall(positiveEntries(request), contents);
    if (Object.keys(missing).length > 0) {
      return {
        ok: false,
        moved: {},
        movedVolume: 0,
        blocked: {
          kind: "missing-source",
          missing,
          message: "Container does not hold the full requested amount.",
        },
      };
    }
  }

  const desired = resolveDesired(request, contents, mode);
  if (Object.keys(desired).length === 0) {
    return {
      ok: false,
      moved: {},
      movedVolume: 0,
      blocked: { kind: "empty-request", message: "Nothing available to move out of the container." },
    };
  }

  const usedBefore = containers.used(state, containerId);
  const moved: ResourceBag = {};
  const destination = bag.get(state);
  const next: ResourceBag = { ...destination };
  for (const [id, amount] of Object.entries(desired)) {
    const { removed } = containers.drain(state, containerId, { contentId: id, amount });
    const got = removed[id] ?? 0;
    if (got > EPSILON) {
      moved[id] = got;
      next[id] = (next[id] ?? 0) + got;
    }
  }

  if (Object.keys(moved).length === 0) {
    return {
      ok: false,
      moved: {},
      movedVolume: 0,
      blocked: { kind: "empty-request", message: "Container had nothing to move." },
    };
  }

  const movedVolume = usedBefore - containers.used(state, containerId);
  bag.set(state, next);
  return { ok: true, moved, movedVolume };
}
