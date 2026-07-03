import type { AmountsInput, Economy, Transaction } from "@idlekitjs/economy";
import type { Project } from "../project";

export interface ProjectFromTransactionOptions<T> {
  title: string;
  description: string;
  /** Visibility predicate (default: always visible). */
  trigger?: (state: T) => boolean;
  repeatable?: boolean;
  /** Cost label override (default: formatted from the transaction's cost). */
  cost?: (state: T) => string;
}

/**
 * Wrap an economy transaction as a project: `affordable` maps to
 * `canExecute` (requirements included, not just the price), `effect` to
 * `execute`, and the cost label is derived from the formatted cost lines.
 * Projects stay autonomous — completed/repeatable bookkeeping remains with
 * the projects mechanic.
 */
export function projectFromTransaction<T>(
  economy: Economy<T>,
  transaction: Transaction<T>,
  options: ProjectFromTransactionOptions<T>,
): Project<T> {
  const resolveCost = (state: T): AmountsInput =>
    typeof transaction.cost === "function" ? transaction.cost(state) : (transaction.cost ?? []);

  const costLabel =
    options.cost ??
    (transaction.cost
      ? (state: T): string =>
          economy
            .formatCost(state, resolveCost(state))
            .map((line) => `${line.amount} ${line.label}`)
            .join(", ")
      : undefined);

  return {
    id: transaction.id,
    title: options.title,
    description: options.description,
    trigger: options.trigger ?? ((): boolean => true),
    affordable: (state) => economy.canExecute(state, transaction),
    effect: (state) => {
      economy.execute(state, transaction);
    },
    cost: costLabel,
    repeatable: options.repeatable,
  };
}
