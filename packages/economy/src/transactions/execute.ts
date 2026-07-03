import type { ResourceAmount } from "../amounts/types";
import { previewTransaction } from "./preview";
import type { Transaction, TransactionExecutor, TransactionResult } from "./types";

/**
 * Run a transaction: everything is computed and checked first (the preview),
 * then — only when the preview is clean — the state is mutated in the fixed
 * order pay -> apply -> credit.
 *
 * There is no rollback: the contract is that `apply` cannot fail (anything
 * blocking must be a requirement), so the only throw window is game code. If
 * `apply` does throw, the exception propagates as the programming error it is.
 */
export function executeTransaction<T>(
  executor: TransactionExecutor<T>,
  state: T,
  transaction: Transaction<T>,
): TransactionResult {
  const preview = previewTransaction(executor, state, transaction);
  if (!preview.ok) {
    return { ok: false, failures: preview.failures, missing: preview.missing };
  }

  for (const line of preview.cost) {
    const def = executor.tryResource(line.resourceId)!;
    def.accessor.add(state, -line.amount);
  }

  transaction.apply?.(state);

  // Overflow is recomputed while crediting: `apply` may have moved balances
  // since the preview, and the caps must hold against the real state.
  const overflow: ResourceAmount[] = [];
  for (const line of preview.reward) {
    const def = executor.tryResource(line.resourceId)!;
    const applied = executor.applyClamped(state, def, line.amount);
    if (applied < line.amount) {
      overflow.push({ resourceId: line.resourceId, amount: line.amount - applied });
    }
  }

  return { ok: true, cost: preview.cost, reward: preview.reward, overflow };
}
