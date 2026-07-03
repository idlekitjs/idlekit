/**
 * Declarative definition of a project (the central pattern of incremental games).
 *
 * The engine knows nothing about the nature of costs: each project describes its
 * own availability (`trigger`), affordability (`affordable`) and effect
 * (`effect`, which pays the cost and applies the result to the state).
 */
export interface Project<T> {
  /** Unique, stable identifier (used for persistence). */
  id: string;
  title: string;
  description: string;
  /** Visible as soon as this predicate is true. */
  trigger: (state: T) => boolean;
  /** Affordable right now (enough resources). */
  affordable: (state: T) => boolean;
  /** Pays the cost and applies the effect. Called only when `affordable`. */
  effect: (state: T) => void;
  /** Cost label for display (optional). */
  cost?: (state: T) => string;
  /** If true, the project stays available after purchase. */
  repeatable?: boolean;
}
