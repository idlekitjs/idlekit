/**
 * @idlekitjs/economy - economic vocabulary and atomic transactions for idle games.
 *
 * A pure package: it defines what a named resource, an amount, a cost, a
 * reward, a requirement, a transaction and a cost curve are — and evaluates
 * them against a state it never owns. Resources are declared explicitly (no
 * state scanning), simulation ticks never go through transactions, and the
 * package depends on nothing but @idlekitjs/utils.
 *
 *   import { createEconomy, stateKey } from "@idlekitjs/economy";
 *
 *   const economy = createEconomy<State>({ format: formatNumber })
 *     .resource({ id: "currency:potatoes", label: "Potatoes", accessor: stateKey("potatoes") });
 *
 *   economy.execute(state, {
 *     id: "buy-upgrade",
 *     cost: [["currency:potatoes", 100]],
 *     apply: (s) => { s.upgrades.push("plow"); },
 *   });
 *
 * Mechanics bridges live next to each mechanic
 * (`@idlekitjs/mechanics/<mechanic>/economy`), so simulation mechanics stay
 * usable without Economy and no dependency cycle can form.
 */

// Resources
export { defineResource, validateResourceId } from "./resources";
export type { ResourceAccessor, ResourceDef, ResourceId, ResourceInit } from "./resources";

// Accessors (also available via the "@idlekitjs/economy/accessors" subpath)
export { arrayIndex, computed, readonly, recordField, stateKey } from "./accessors";
export type {
  ArrayIndexOptions,
  NumberFields,
  NumberKeys,
  ReadonlyResourceAccessor,
  RecordFieldOptions,
} from "./accessors";

// Economy instance
export { createEconomy, EconomyError } from "./economy";
export type { Economy, EconomyOptions, EconomyReader } from "./economy";

// Amounts
export { collectAmounts, mergeAmounts, normalizeAmounts, scaleAmounts } from "./amounts";
export type { AmountsInput, CollectedAmounts, Cost, ResourceAmount, Reward } from "./amounts";

// Requirements
export { allOf, not, resourceAtLeast, resourceAtMost } from "./requirements";
export type { Requirement } from "./requirements";

// Transactions
export { executeTransaction, previewTransaction } from "./transactions";
export type {
  CostInput,
  RewardInput,
  Transaction,
  TransactionExecutor,
  TransactionFailure,
  TransactionPreview,
  TransactionResources,
  TransactionResult,
} from "./transactions";

// Cost curves (also available via the "@idlekitjs/economy/cost-curves" subpath)
export { costCurve, flat, geometric, geometricAffordable, geometricSum } from "./cost-curves";
export type { CostCurve, CostCurveLine, CostCurveOptions, Rounding } from "./cost-curves";

// Formatting view models
export { describeFailure } from "./format";
export type { DescribeFailureOptions, FormattedAmount, FormattedCostLine } from "./format";
