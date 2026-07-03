import type { ResourceId } from "../resources/types";
import type { TransactionFailure } from "../transactions/types";

export interface DescribeFailureOptions {
  /** Resolve a display name for a resource id (defaults to the id itself). */
  label?: (id: ResourceId) => string;
}

/**
 * Plain-English sentence for one transaction failure — a sane default for
 * tooltips, logs and tests. Games wanting localized or styled messages should
 * switch on `failure.kind` themselves; every variant is a plain data object.
 */
export function describeFailure(
  failure: TransactionFailure,
  options: DescribeFailureOptions = {},
): string {
  const label = options.label ?? ((id: ResourceId): string => id);
  switch (failure.kind) {
    case "unknown-resource":
      return `Unknown resource "${failure.resourceId}" in ${failure.where}.`;
    case "invalid-amount":
      return `Invalid amount ${failure.amount} of "${label(failure.resourceId)}" in ${failure.where}.`;
    case "invalid-state":
      return `Resource "${label(failure.resourceId)}" has an invalid balance.`;
    case "requirement-failed": {
      const name = failure.label ?? failure.requirementId;
      const progress = failure.progress
        ? ` (${failure.progress.current}/${failure.progress.target})`
        : "";
      return `Requirement not met: ${name}${progress}.`;
    }
    case "cannot-afford":
      return `Not enough ${label(failure.resourceId)}: requires ${failure.required}, available ${failure.available}.`;
    case "readonly-resource":
      return `Resource "${label(failure.resourceId)}" is read-only and cannot appear in ${failure.where}.`;
  }
}
