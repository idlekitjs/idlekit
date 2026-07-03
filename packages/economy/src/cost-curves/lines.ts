import { EconomyError } from "../economy/errors";
import type { ResourceId } from "../resources/types";
import type { CostCurveLine, Rounding } from "./types";

/**
 * Line factories with wiring-time validation: curves are static definitions,
 * so a bad growth or amount must throw at creation, never mid-game.
 */

export function flat(
  resourceId: ResourceId,
  amount: number,
  options: { round?: Rounding } = {},
): CostCurveLine {
  const line: CostCurveLine = { kind: "flat", resourceId, amount, round: options.round };
  validateLine(line);
  return line;
}

export function geometric(
  resourceId: ResourceId,
  options: { baseAmount: number; growth: number; round?: Rounding },
): CostCurveLine {
  const line: CostCurveLine = {
    kind: "geometric",
    resourceId,
    baseAmount: options.baseAmount,
    growth: options.growth,
    round: options.round,
  };
  validateLine(line);
  return line;
}

/** Shared with `costCurve`, which also accepts raw line literals. */
export function validateLine(line: CostCurveLine): void {
  if (line.kind === "flat") {
    if (!Number.isFinite(line.amount) || line.amount < 0) {
      throw new EconomyError(
        `Flat cost line for "${line.resourceId}" needs a finite amount >= 0, got ${line.amount}.`,
      );
    }
    return;
  }
  if (!Number.isFinite(line.baseAmount) || line.baseAmount < 0) {
    throw new EconomyError(
      `Geometric cost line for "${line.resourceId}" needs a finite baseAmount >= 0, got ${line.baseAmount}.`,
    );
  }
  if (!Number.isFinite(line.growth) || line.growth <= 0) {
    throw new EconomyError(
      `Geometric cost line for "${line.resourceId}" needs a finite growth > 0, got ${line.growth}.`,
    );
  }
}
