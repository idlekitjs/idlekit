/** Who a modifier applies to. */
export type ModifierTarget =
  { kind: "all" } | { kind: "id"; id: string } | { kind: "tag"; tag: string };

/**
 * A single bonus contribution. Modifiers are grouped by `source` in the
 * registry (see `ModifierRegistry.set`), so the `source` itself is not part of
 * this shape.
 */
export interface Modifier {
  target: ModifierTarget;
  /** Stat affected, e.g. "yield" or "speed". */
  stat: string;
  op: "add" | "mult";
  value: number;
}

/** What to resolve: a stat for a given entity (by id and/or tags). */
export interface ResolveQuery {
  stat: string;
  /** Starting value before modifiers (default: 1). */
  base?: number;
  id?: string;
  tags?: readonly string[];
}
