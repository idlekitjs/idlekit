import { Random } from "@idlekitjs/core";
import type {
  CollectibleDef,
  CollectibleEntry,
  CollectibleView,
  CollectionExtension,
  CollectionOptions,
  CostDef,
  Curve,
  OpenPackResult,
  OpenPackReward,
  PackRewardDef,
  UpgradeCheck,
  UpgradeRequirements,
  WeightedInt,
} from "./types";

const ZERO_ENTRY: CollectibleEntry = { quantity: 0, level: 0 };
const noUpgrade: Curve = () => 0;

/**
 * Collection: the gacha + upgrade hub. It draws collectibles from packs with a
 * seeded PRNG (reproducible, save-scum proof), tracks copies/levels in the
 * state, and feeds the `ModifierRegistry` with each active collectible's
 * effects resolved at its current level.
 *
 * The plugin is pure mechanics: rarities, collectibles, packs and currencies are
 * supplied as data by the game. Effects are published under the source
 * `collectible:<id>` so a single collectible can be updated atomically.
 */
export function collection<T extends object>(
  options: CollectionOptions<T>,
): CollectionExtension<T> {
  const { registry } = options;
  const defsById = new Map(options.collectibles.map((def) => [def.id, def]));
  const rarityById = new Map(options.rarities.map((rarity) => [rarity.id, rarity]));
  const packsById = new Map(options.packs.map((pack) => [pack.id, pack]));
  const currencyById = new Map(options.currencies.map((currency) => [currency.id, currency]));

  const seedFallback = (): number => options.seed ?? Date.now() >>> 0;

  const duplicatesCurve = (def: CollectibleDef<T>): Curve =>
    def.upgrade?.duplicates ?? rarityById.get(def.rarity)?.defaults?.duplicates ?? noUpgrade;
  const costsOf = (def: CollectibleDef<T>): CostDef[] =>
    def.upgrade?.costs ?? rarityById.get(def.rarity)?.defaults?.costs ?? [];
  const maxLevelOf = (def: CollectibleDef<T>): number =>
    def.upgrade?.maxLevel ?? rarityById.get(def.rarity)?.defaults?.maxLevel ?? Infinity;

  const entryOf = (state: T, id: string): CollectibleEntry =>
    options.getData(state).collectibles[id] ?? ZERO_ENTRY;

  function duplicateCapacity(def: CollectibleDef<T>, entry: CollectibleEntry): number {
    const maxLevel = maxLevelOf(def);
    if (!Number.isFinite(maxLevel)) {
      return Infinity;
    }
    if (entry.level >= maxLevel) {
      return 0;
    }

    const duplicates = duplicatesCurve(def);
    let needed = 0;
    for (let level = entry.level; level < maxLevel; level++) {
      const amount = Math.ceil(duplicates(level));
      if (!Number.isFinite(amount)) {
        return Infinity;
      }
      needed += Math.max(0, amount);
    }
    return Math.max(0, needed - entry.quantity);
  }

  function isDuplicateSaturated(def: CollectibleDef<T>, entry: CollectibleEntry): boolean {
    return duplicateCapacity(def, entry) <= 0;
  }

  function canUpgrade(id: string, state: T): UpgradeCheck {
    const def = defsById.get(id);
    const entry = def ? entryOf(state, id) : ZERO_ENTRY;
    const level = entry.level;
    const duplicatesRequired = def ? Math.ceil(duplicatesCurve(def)(level)) : 0;
    const costs = (def ? costsOf(def) : []).map((cost) => ({
      currency: cost.currency,
      required: cost.amount(level),
      available: currencyById.get(cost.currency)?.get(state) ?? 0,
    }));
    const requirements: UpgradeRequirements = {
      level,
      nextLevel: level + 1,
      duplicatesRequired,
      duplicatesAvailable: entry.quantity,
      costs,
    };

    if (!def) {
      return { ok: false, reason: "not-owned", requirements };
    }
    if (def.eligibility?.upgradeable && !def.eligibility.upgradeable(state)) {
      return { ok: false, reason: "not-eligible", requirements };
    }
    if (level >= maxLevelOf(def)) {
      return { ok: false, reason: "max-level", requirements };
    }
    if (entry.quantity === 0 && level === 0) {
      return { ok: false, reason: "not-owned", requirements };
    }
    if (entry.quantity < duplicatesRequired) {
      return { ok: false, reason: "not-enough-duplicates", requirements };
    }
    for (const cost of costs) {
      if (cost.available < cost.required) {
        return { ok: false, reason: "not-enough-currency", requirements };
      }
    }
    return { ok: true, requirements };
  }

  function publishEffects(id: string, state: T): void {
    const def = defsById.get(id);
    if (!def) {
      return;
    }
    const entry = entryOf(state, id);
    const active = def.eligibility?.active?.(state) ?? true;
    if (entry.level > 0 && active && def.effects?.length) {
      registry.set(
        `collectible:${id}`,
        def.effects.map((effect) => ({
          target: effect.target,
          stat: effect.stat,
          op: effect.op,
          value: effect.value(entry.level),
        })),
      );
    } else {
      registry.remove(`collectible:${id}`);
    }
  }

  function rebuildModifiers(state: T): void {
    for (const def of options.collectibles) {
      publishEffects(def.id, state);
    }
  }

  function upgrade(id: string, state: T): boolean {
    const check = canUpgrade(id, state);
    if (!check.ok) {
      return false;
    }
    const { requirements } = check;
    const data = options.getData(state);
    const entry = data.collectibles[id] ?? ZERO_ENTRY;

    for (const cost of requirements.costs) {
      currencyById.get(cost.currency)?.spend(state, cost.required);
    }
    options.setData(state, {
      collectibles: {
        ...data.collectibles,
        [id]: {
          quantity: entry.quantity - requirements.duplicatesRequired,
          level: entry.level + 1,
        },
      },
      rngState: data.rngState,
    });

    publishEffects(id, state);
    options.onChange?.(state);
    return true;
  }

  function droppableByRarity(state: T): Map<string, CollectibleDef<T>[]> {
    const buckets = new Map<string, CollectibleDef<T>[]>();
    for (const def of options.collectibles) {
      if (!(def.eligibility?.droppable?.(state) ?? true)) {
        continue;
      }
      if (isDuplicateSaturated(def, entryOf(state, def.id))) {
        continue;
      }
      const bucket = buckets.get(def.rarity);
      if (bucket) {
        bucket.push(def);
      } else {
        buckets.set(def.rarity, [def]);
      }
    }
    return buckets;
  }

  function resolveInt(random: Random, value: WeightedInt | undefined): number {
    if (value === undefined) {
      return 0;
    }
    if (typeof value === "number") {
      return Math.max(0, Math.floor(value));
    }
    if ("min" in value) {
      return Math.max(0, random.range(Math.ceil(value.min), Math.floor(value.max)));
    }
    if (value.choices.length === 0 || value.choices.every((choice) => choice.weight <= 0)) {
      return 0;
    }
    return Math.max(
      0,
      Math.floor(
        random.weighted(
          value.choices.map((choice) => choice.value),
          value.choices.map((choice) => choice.weight),
        ),
      ),
    );
  }

  function drawByWeights(
    random: Random,
    buckets: Map<string, CollectibleDef<T>[]>,
    rarityWeights?: Record<string, number>,
  ): CollectibleDef<T> | undefined {
    const rarityIds = [...buckets.keys()];
    if (rarityIds.length === 0) {
      return undefined;
    }
    const weights = rarityIds.map(
      (rarity) => rarityWeights?.[rarity] ?? rarityById.get(rarity)?.weight ?? 0,
    );
    if (weights.every((weight) => weight <= 0)) {
      return undefined;
    }

    const rarityId = random.weighted(rarityIds, weights);
    const bucket = buckets.get(rarityId);
    return bucket && bucket.length > 0 ? random.pick(bucket) : undefined;
  }

  function addCardReward(
    rewards: OpenPackReward[],
    collectibles: Record<string, CollectibleEntry>,
    def: CollectibleDef<T>,
    quantity: number,
  ): void {
    if (quantity <= 0) {
      return;
    }
    const previous = collectibles[def.id] ?? ZERO_ENTRY;
    const gained = Math.min(quantity, duplicateCapacity(def, previous));
    if (!Number.isFinite(gained) && Number.isFinite(quantity)) {
      return;
    }
    const actualQuantity = Number.isFinite(gained) ? gained : quantity;
    if (actualQuantity <= 0) {
      return;
    }
    const newEntry: CollectibleEntry = {
      quantity: previous.quantity + actualQuantity,
      level: previous.level,
    };
    collectibles[def.id] = newEntry;

    const existing = rewards.find(
      (reward): reward is Extract<OpenPackReward, { kind: "card" }> =>
        reward.kind === "card" && reward.collectibleId === def.id,
    );
    if (existing) {
      existing.quantity += actualQuantity;
      existing.newQuantity = newEntry.quantity;
      return;
    }

    rewards.push({
      kind: "card",
      collectibleId: def.id,
      rarity: def.rarity,
      quantity: actualQuantity,
      previousQuantity: previous.quantity,
      newQuantity: newEntry.quantity,
      wasNew: previous.quantity === 0 && previous.level === 0,
      canUpgradeAfter: false,
    });
  }

  function removeFromBuckets(
    buckets: Map<string, CollectibleDef<T>[]>,
    def: CollectibleDef<T>,
    collectibles: Record<string, CollectibleEntry>,
  ): void {
    const entry = collectibles[def.id] ?? ZERO_ENTRY;
    if (!isDuplicateSaturated(def, entry)) {
      return;
    }
    const bucket = buckets.get(def.rarity);
    if (!bucket) {
      return;
    }
    const next = bucket.filter((candidate) => candidate.id !== def.id);
    if (next.length > 0) {
      buckets.set(def.rarity, next);
    } else {
      buckets.delete(def.rarity);
    }
  }

  function addCurrencyReward(
    random: Random,
    reward: PackRewardDef,
    state: T,
    rewards: OpenPackReward[],
  ): void {
    if (reward.kind !== "currency") {
      return;
    }
    const currency = currencyById.get(reward.currency);
    if (!currency?.add) {
      return;
    }
    const amount = resolveInt(random, reward.amount);
    if (amount <= 0) {
      return;
    }
    const previousAmount = currency.get(state);
    currency.add(state, amount);
    rewards.push({
      kind: "currency",
      currencyId: reward.currency,
      amount,
      previousAmount,
      newAmount: currency.get(state),
    });
  }

  function openPack(packId: string, state: T): OpenPackResult {
    const pack = packsById.get(packId);
    if (!pack) {
      throw new Error(`collection.openPack: unknown pack "${packId}".`);
    }
    if (pack.eligibility?.openable && !pack.eligibility.openable(state)) {
      return { packId, rewards: [] };
    }

    const data = options.getData(state);
    const random = new Random(data.rngState || seedFallback());
    const collectibles = { ...data.collectibles };
    const buckets = droppableByRarity(state);
    const rewards: OpenPackReward[] = [];

    if (pack.rewards) {
      for (const reward of pack.rewards) {
        if (reward.kind === "currency") {
          addCurrencyReward(random, reward, state, rewards);
          continue;
        }

        const count = resolveInt(random, reward.count);
        for (let draw = 0; draw < count; draw++) {
          const fixedBucket = reward.rarity ? buckets.get(reward.rarity) : undefined;
          const chosen = reward.rarity
            ? fixedBucket && fixedBucket.length > 0
              ? random.pick(fixedBucket)
              : undefined
            : drawByWeights(random, buckets, reward.rarityWeights);
          if (!chosen) {
            continue;
          }
          addCardReward(rewards, collectibles, chosen, 1);
          removeFromBuckets(buckets, chosen, collectibles);
        }
      }
    } else {
      const draws = resolveInt(random, pack.draws);
      for (let draw = 0; draw < draws; draw++) {
        const chosen = drawByWeights(random, buckets, pack.rarityWeights);
        if (!chosen) {
          break;
        }
        addCardReward(rewards, collectibles, chosen, 1);
        removeFromBuckets(buckets, chosen, collectibles);
      }
    }

    options.setData(state, { collectibles, rngState: random.state });
    for (const reward of rewards) {
      if (reward.kind === "card") {
        reward.canUpgradeAfter = canUpgrade(reward.collectibleId, state).ok;
      }
    }
    options.onChange?.(state);
    return { packId, rewards };
  }

  function viewOf(def: CollectibleDef<T>, entry: CollectibleEntry): CollectibleView {
    return {
      id: def.id,
      rarity: def.rarity,
      level: entry.level,
      quantity: entry.quantity,
      tags: def.tags,
      metadata: def.metadata,
    };
  }

  function getCollectible(id: string, state: T): CollectibleView | undefined {
    const def = defsById.get(id);
    return def ? viewOf(def, entryOf(state, id)) : undefined;
  }

  function getVisible(state: T): CollectibleView[] {
    const views: CollectibleView[] = [];
    for (const def of options.collectibles) {
      if (def.eligibility?.visible?.(state) ?? true) {
        views.push(viewOf(def, entryOf(state, def.id)));
      }
    }
    return views;
  }

  return {
    id: "collection",
    setup(engine) {
      engine.events.on("loaded", () => rebuildModifiers(engine.state));
    },
    openPack,
    canUpgrade,
    upgrade,
    getCollectible,
    getVisible,
    rebuildModifiers,
  };
}
