import type { ResourceAmount } from "../amounts/types";
import type {
  CostInput,
  Transaction,
  TransactionFailure,
  TransactionPreview,
  TransactionResources,
} from "./types";

/**
 * Resolve one side (cost or reward) of a transaction: call the function form
 * once, coerce tuples, validate each line against the registry, merge
 * duplicates of the valid lines, drop zero totals. Invalid lines become
 * failures instead of throwing — transactions are content, not code.
 */
function resolveLines<T>(
  resources: TransactionResources<T>,
  state: T,
  input: CostInput<T> | undefined,
  where: "cost" | "reward",
  failures: TransactionFailure[],
): ResourceAmount[] {
  const raw = typeof input === "function" ? input(state) : (input ?? []);
  const merged = new Map<string, number>();

  for (const entry of raw) {
    const line = Array.isArray(entry)
      ? { resourceId: entry[0] as string, amount: entry[1] as number }
      : (entry as ResourceAmount);

    const def = resources.tryResource(line.resourceId);
    if (!def) {
      failures.push({ kind: "unknown-resource", resourceId: line.resourceId, where });
      continue;
    }
    if (!Number.isFinite(line.amount) || line.amount < 0) {
      failures.push({
        kind: "invalid-amount",
        resourceId: line.resourceId,
        amount: line.amount,
        where,
      });
      continue;
    }
    if (def.integer && !Number.isInteger(line.amount)) {
      failures.push({
        kind: "invalid-amount",
        resourceId: line.resourceId,
        amount: line.amount,
        where,
      });
      continue;
    }
    if (def.readonly) {
      failures.push({ kind: "readonly-resource", resourceId: line.resourceId, where });
      continue;
    }
    merged.set(line.resourceId, (merged.get(line.resourceId) ?? 0) + line.amount);
  }

  const lines: ResourceAmount[] = [];
  for (const [resourceId, amount] of merged) {
    if (amount > 0) {
      lines.push({ resourceId, amount });
    }
  }
  return lines;
}

/**
 * Pure evaluation of a transaction: resolves and validates cost/reward, checks
 * every requirement and every cost line, and reports reward overflow — without
 * mutating anything and without stopping at the first failure. `execute` is
 * built on top of this exact function, so the two can never disagree.
 */
export function previewTransaction<T>(
  resources: TransactionResources<T>,
  state: T,
  transaction: Transaction<T>,
): TransactionPreview {
  const failures: TransactionFailure[] = [];
  const cost = resolveLines(resources, state, transaction.cost, "cost", failures);
  const reward = resolveLines(resources, state, transaction.reward, "reward", failures);

  for (const requirement of transaction.requirements ?? []) {
    if (!requirement.isMet(state, resources)) {
      failures.push({
        kind: "requirement-failed",
        requirementId: requirement.id,
        label: requirement.label,
        progress: requirement.progress?.(state, resources),
      });
    }
  }

  const missing: ResourceAmount[] = [];
  for (const line of cost) {
    const def = resources.tryResource(line.resourceId)!;
    const balance = def.accessor.get(state);
    if (!Number.isFinite(balance)) {
      failures.push({ kind: "invalid-state", resourceId: line.resourceId });
      continue;
    }
    const available = balance - def.min;
    if (available < line.amount) {
      failures.push({
        kind: "cannot-afford",
        resourceId: line.resourceId,
        required: line.amount,
        available,
      });
      missing.push({ resourceId: line.resourceId, amount: line.amount - available });
    }
  }

  const overflow: ResourceAmount[] = [];
  for (const line of reward) {
    const def = resources.tryResource(line.resourceId)!;
    const balance = def.accessor.get(state);
    if (!Number.isFinite(balance)) {
      failures.push({ kind: "invalid-state", resourceId: line.resourceId });
      continue;
    }
    const over = balance + line.amount - def.max;
    if (over > 0) {
      overflow.push({ resourceId: line.resourceId, amount: Math.min(over, line.amount) });
    }
  }

  return { ok: failures.length === 0, failures, cost, reward, missing, overflow };
}
