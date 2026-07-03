import { clamp } from "@idlekitjs/utils";
import type { ProducersExtension, ProducersOptions, PurchaseResult } from "./types";

/**
 * `Math.pow`/`Math.log` are not correctly rounded and may differ by an ulp
 * between JS engines, so a budget sitting exactly on a series total can flip
 * the affordable count by one across environments. Affordability therefore
 * tolerates a relative drift far above 1-ulp noise but far below any real
 * price step.
 */
const BUDGET_TOLERANCE = 1e-9;

function fitsBudget(amount: number, budget: number): boolean {
  return amount <= budget + budget * BUDGET_TOLERANCE;
}

/**
 * Producers: the cascade of tiers where each tier produces the one below it and
 * tier 0 produces the resource. The mechanic (cycles, cascade, costs) lives
 * here; the tiers (names, tuning) stay as data in the game.
 *
 * Purchasing is split in two: the mechanic owns the cost math (geometric curve,
 * exact bulk pricing, budget inversion), while *what* is spent goes through the
 * `purchase` seam — a scalar budget per tier that the game defines. Without the
 * seam, the main `resource` is the currency.
 *
 * Offline progress is handled for free: a large `dt` (via `engine.advance`) makes
 * `floor(progress / cycleTime)` credit every batch that completed while away.
 * Manual (non-automated) tiers are the exception: one `run()` arms exactly one
 * cycle, so a large `dt` completes that single cycle and discards the excess.
 */
export function producers<T extends object>(options: ProducersOptions<T>): ProducersExtension<T> {
  const defs = options.definitions;
  const yieldOf = (state: T, index: number): number =>
    options.getYieldMultiplier?.(state, index) ?? 1;
  const speedOf = (state: T, index: number): number =>
    options.getSpeedMultiplier?.(state, index) ?? 1;
  const automatedOf = (state: T, index: number): boolean =>
    options.getIsAutomated?.(state, index) ?? true;
  const budgetOf = (state: T, index: number): number =>
    options.purchase ? options.purchase.getBudget(state, index) : options.resource.get(state);
  const pay = (state: T, index: number, amount: number): void => {
    if (options.purchase) {
      options.purchase.pay(state, index, amount);
      return;
    }
    options.resource.add(state, -amount);
  };

  function quantityOf(quantity: number): number {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return 0;
    }
    return Math.min(Math.floor(quantity), Number.MAX_SAFE_INTEGER);
  }

  function cost(index: number, state: T): number {
    const def = defs[index];
    if (!def) {
      return Infinity;
    }
    const owned = options.getColumn(state).owned[index] ?? 0;
    return def.baseCost * Math.pow(def.costGrowth, owned);
  }

  function costFor(index: number, state: T, quantity: number): number {
    const count = quantityOf(quantity);
    if (count === 0) {
      return 0;
    }

    const def = defs[index];
    if (!def) {
      return Infinity;
    }
    if (!Number.isFinite(def.baseCost) || def.baseCost < 0) {
      return Infinity;
    }
    const growth = def.costGrowth;
    if (!Number.isFinite(growth) || growth <= 0) {
      return Infinity;
    }

    const owned = options.getColumn(state).owned[index] ?? 0;
    const first = def.baseCost * Math.pow(growth, owned);
    if (!Number.isFinite(first)) {
      return Infinity;
    }
    if (growth === 1) {
      return first * count;
    }
    return (first * (Math.pow(growth, count) - 1)) / (growth - 1);
  }

  function maxAffordable(index: number, state: T, budget = budgetOf(state, index)): number {
    const def = defs[index];
    if (!def || !Number.isFinite(budget) || budget <= 0) {
      return 0;
    }

    const first = cost(index, state);
    if (!Number.isFinite(first) || first < 0) {
      return 0;
    }
    if (first === 0) {
      return Number.MAX_SAFE_INTEGER;
    }
    if (!fitsBudget(first, budget)) {
      return 0;
    }

    const growth = def.costGrowth;
    if (!Number.isFinite(growth) || growth <= 0) {
      return 0;
    }
    if (growth === 1) {
      return quantityOf(Math.floor(budget / first));
    }

    const raw = Math.log((budget * (growth - 1)) / first + 1) / Math.log(growth);
    let quantity = quantityOf(Math.floor(raw + 1e-12));

    // Floating point precision around powers can over/under-shoot by one. Keep
    // the correction bounded; the geometric inverse still does the real work.
    for (let i = 0; i < 8 && quantity > 0 && !fitsBudget(costFor(index, state, quantity), budget); i++) {
      quantity--;
    }
    for (let i = 0; i < 8 && fitsBudget(costFor(index, state, quantity + 1), budget); i++) {
      quantity++;
    }
    return quantity;
  }

  function purchaseMany(index: number, state: T, quantity: number): PurchaseResult {
    const def = defs[index];
    const wanted = quantityOf(quantity);
    const currentBudget = budgetOf(state, index);
    if (!def) {
      return { bought: 0, spent: 0, remaining: currentBudget };
    }
    const bought = Math.min(wanted, maxAffordable(index, state, currentBudget));
    if (bought <= 0) {
      return { bought: 0, spent: 0, remaining: currentBudget };
    }
    const priced = costFor(index, state, bought);
    if (!Number.isFinite(priced) || !fitsBudget(priced, currentBudget)) {
      return { bought: 0, spent: 0, remaining: currentBudget };
    }
    // A boundary purchase may price an ulp above the budget; never debit more
    // than the budget itself.
    const spent = Math.min(priced, currentBudget);
    pay(state, index, spent);

    const column = options.getColumn(state);
    const owned = column.owned.slice();
    const total = column.total.slice();
    const wasEmpty = total[index] <= 0;
    owned[index] += bought;
    total[index] += bought;
    options.setColumn(state, { owned, total });

    // Activating a tier (0 -> N) starts its cycle from zero, regardless of any
    // stale banked time, so the bar visibly fills from the beginning.
    if (wasEmpty) {
      column.progress[index] = 0;
    }

    const result = { bought, spent, remaining: budgetOf(state, index) };
    options.onPurchase?.(index, state, result);
    return result;
  }

  function grant(
    index: number,
    state: T,
    quantity: number,
    grantOptions?: { owned?: boolean },
  ): boolean {
    const def = defs[index];
    const count = quantityOf(quantity);
    if (!def || count === 0) {
      return false;
    }

    const column = options.getColumn(state);
    const total = column.total.slice();
    const wasEmpty = total[index] <= 0;
    total[index] += count;
    const patch: { total: number[]; owned?: number[] } = { total };
    if (grantOptions?.owned) {
      const owned = column.owned.slice();
      owned[index] += count;
      patch.owned = owned;
    }
    options.setColumn(state, patch);

    // Same rule as purchases: activating an empty tier starts its cycle from
    // zero, so the bar visibly fills from the beginning.
    if (wasEmpty) {
      column.progress[index] = 0;
    }
    return true;
  }

  return {
    id: "producers",

    update(state, dt) {
      const column = options.getColumn(state);
      const counts = column.total;
      const progress = column.progress;

      let resourceGain = 0;
      let cascade: number[] | null = null;
      let runningPatch: boolean[] | null = null;
      const stopRunning = (index: number): void => {
        if (!((runningPatch ?? column.running)?.[index] ?? false)) {
          return;
        }
        runningPatch ??= defs.map((_, i) => column.running?.[i] ?? false);
        runningPatch[index] = false;
      };

      for (let i = 0; i < defs.length; i++) {
        // An empty tier is inactive and banks no time. Forcing progress to 0
        // (not just skipping) also heals legacy saves that accumulated time
        // while empty, so the first unit always starts a fresh cycle. A stale
        // running flag is cleared too: it must not auto-start the tier later.
        if (counts[i] <= 0) {
          progress[i] = 0;
          stopRunning(i);
          continue;
        }
        const speed = speedOf(state, i);
        // Stopped (e.g. a debuff): pause but keep the accumulated progress.
        if (speed <= 0) {
          continue;
        }
        const automated = automatedOf(state, i);
        // Manual tier with no cycle armed: idle, banks no time.
        if (!automated && !(column.running?.[i] ?? false)) {
          continue;
        }
        const cycleTime = defs[i].cycleTime / speed;
        progress[i] += dt;
        if (progress[i] < cycleTime) {
          continue;
        }

        let cycles: number;
        if (automated) {
          cycles = Math.floor(progress[i] / cycleTime);
          progress[i] -= cycles * cycleTime;
        } else {
          // One run() = one cycle: credit it, drop any excess time (offline
          // included) and stop until the next run().
          cycles = 1;
          progress[i] = 0;
          stopRunning(i);
        }

        const output = cycles * counts[i] * defs[i].yieldPerUnit * yieldOf(state, i);
        if (output <= 0) {
          continue;
        }

        if (i === 0) {
          resourceGain += output;
        } else {
          // Snapshot of the starting counts: every tier consumes the same tick.
          cascade ??= counts.slice();
          cascade[i - 1] += output;
        }
      }

      if (resourceGain > 0) {
        options.resource.add(state, resourceGain);
      }
      if (cascade || runningPatch) {
        options.setColumn(state, {
          ...(cascade ? { total: cascade } : {}),
          ...(runningPatch ? { running: runningPatch } : {}),
        });
      }
    },

    purchase(index, state) {
      return purchaseMany(index, state, 1).bought === 1;
    },

    purchaseMany(index, state, quantity) {
      return purchaseMany(index, state, quantity);
    },

    purchaseWithBudget(index, state, budget) {
      return purchaseMany(index, state, maxAffordable(index, state, budget));
    },

    grant,

    cost,
    costFor,
    maxAffordable,

    run(index, state) {
      const def = defs[index];
      if (!def) {
        return false;
      }
      const column = options.getColumn(state);
      if ((column.total[index] ?? 0) <= 0) {
        return false;
      }
      // An automated tier is already cycling; a manual cycle in flight is not
      // restarted. Arming resumes any progress frozen by a pause or an
      // automation card wearing off — it never resets it.
      if (automatedOf(state, index)) {
        return false;
      }
      if (column.running?.[index] ?? false) {
        return false;
      }
      const running = defs.map((_, i) => column.running?.[i] ?? false);
      running[index] = true;
      options.setColumn(state, { running });
      return true;
    },

    isRunning(state, index) {
      if (!defs[index]) {
        return false;
      }
      const column = options.getColumn(state);
      if ((column.total[index] ?? 0) <= 0) {
        return false;
      }
      if (automatedOf(state, index)) {
        return true;
      }
      return column.running?.[index] ?? false;
    },

    ratePerSecond(state, index = 0) {
      const def = defs[index];
      if (!def) {
        return 0;
      }
      const count = options.getColumn(state).total[index] ?? 0;
      return (
        (count * def.yieldPerUnit * yieldOf(state, index) * speedOf(state, index)) / def.cycleTime
      );
    },

    progressFraction(state, index) {
      const def = defs[index];
      if (!def) {
        return 0;
      }
      const column = options.getColumn(state);
      // No units -> the tier is inactive: an empty bar, never advancing.
      if ((column.total[index] ?? 0) <= 0) {
        return 0;
      }
      const speed = speedOf(state, index);
      if (speed <= 0) {
        return 0;
      }
      const cycleTime = def.cycleTime / speed;
      if (cycleTime <= 0) {
        return 1;
      }
      const progress = column.progress[index] ?? 0;
      return clamp(progress / cycleTime, 0, 1);
    },

    effectiveCycleTime(state, index) {
      const def = defs[index];
      if (!def) {
        return Infinity;
      }
      // Treat an empty tier as stopped, so the UI shows it as inactive rather
      // than as a (very fast or filling) running cycle.
      if ((options.getColumn(state).total[index] ?? 0) <= 0) {
        return Infinity;
      }
      const speed = speedOf(state, index);
      if (speed <= 0) {
        return Infinity;
      }
      return def.cycleTime / speed;
    },
  };
}
