import type { ResourceId } from "../resources/types";

/**
 * UI-agnostic view models: everything a game UI needs to display an amount
 * (label, formatted text, raw value) without Economy ever touching the DOM.
 * Icons, colors and layout stay on the game side (use `ResourceDef.metadata`).
 */
export interface FormattedAmount {
  resourceId: ResourceId;
  /** Resource display name. */
  label: string;
  /** Formatted amount, via the resource formatter or the economy-wide one. */
  amount: string;
  rawAmount: number;
}

/** A cost line enriched with affordability, ready for a buy button/tooltip. */
export interface FormattedCostLine extends FormattedAmount {
  /** Spendable balance right now (current balance minus the resource's `min`). */
  available: number;
  affordable: boolean;
}
