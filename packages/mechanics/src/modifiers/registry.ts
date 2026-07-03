import type { Modifier, ModifierTarget, ResolveQuery } from "./types";

/**
 * Aggregates modifiers from many sources and resolves an effective value for a
 * target. The formula is the standard, commutative idle stack:
 *
 *     effective = (base + Σ add) × Π mult
 *
 * Modifiers are keyed by `source` (e.g. "card:comrade-power", "projects"), so a
 * source can be updated or removed atomically without tracking individual
 * contributions. The registry holds no game state and is never serialized: the
 * sources re-apply their modifiers on load.
 */
export class ModifierRegistry {
  private readonly bySource = new Map<string, Modifier[]>();

  /** Replace all modifiers contributed by `source` (empty list removes them). */
  set(source: string, modifiers: Modifier[]): void {
    if (modifiers.length === 0) {
      this.bySource.delete(source);
    } else {
      this.bySource.set(source, modifiers);
    }
  }

  remove(source: string): void {
    this.bySource.delete(source);
  }

  clear(): void {
    this.bySource.clear();
  }

  /** Effective value of `query.stat` for the queried entity. */
  resolve(query: ResolveQuery): number {
    const base = query.base ?? 1;
    let add = 0;
    let mult = 1;

    for (const modifiers of this.bySource.values()) {
      for (const modifier of modifiers) {
        if (modifier.stat !== query.stat || !matches(modifier.target, query)) {
          continue;
        }
        if (modifier.op === "add") {
          add += modifier.value;
        } else {
          mult *= modifier.value;
        }
      }
    }

    return (base + add) * mult;
  }
}

function matches(target: ModifierTarget, query: ResolveQuery): boolean {
  switch (target.kind) {
    case "all":
      return true;
    case "id":
      return target.id === query.id;
    case "tag":
      return query.tags?.includes(target.tag) ?? false;
  }
}
