/**
 * @idlekitjs/mechanics - reusable idle gameplay primitives.
 *
 * Each factory returns an `Extension<T>` installable via `engine.use(...)`. These
 * are gameplay building blocks (producers, modifiers, collections, projects,
 * crafting, boosts); game-specific meaning (names, icons, balancing) stays on
 * the game side.
 *
 * Prefer the subpath imports for lean bundles:
 *
 *   import { producers } from "@idlekitjs/mechanics/producers";
 *   import { ModifierRegistry } from "@idlekitjs/mechanics/modifiers";
 *   import { collection } from "@idlekitjs/mechanics/collections";
 */
export { producers } from "./producers";
export type {
  ProducerDef,
  ProducerColumn,
  PurchaseResult,
  ProducersOptions,
  ProducersExtension,
} from "./producers";

export { modifiers, ModifierRegistry } from "./modifiers";
export type { Modifier, ModifierTarget, ResolveQuery, ModifiersExtension } from "./modifiers";

export { collection } from "./collections";
export type {
  Curve,
  Condition,
  CollectibleEffect,
  CostDef,
  UpgradeDef,
  Eligibility,
  CollectibleDef,
  RarityDef,
  WeightedIntChoice,
  WeightedInt,
  PackRewardDef,
  PackDef,
  CurrencyAccessor,
  CollectibleEntry,
  CollectionData,
  CollectionOptions,
  CollectionExtension,
  OpenPackReward,
  OpenPackResult,
  UpgradeRequirements,
  UpgradeBlockedReason,
  UpgradeCheck,
  CollectibleView,
} from "./collections";

export { projects, ProjectManager } from "./projects";
export type { Project, ProjectsOptions, ProjectsExtension } from "./projects";

export { crafting, addResources, subtractResources, canAfford, missingResources } from "./crafting";
export type {
  ResourceBag,
  RecipeDef,
  MachineDef,
  CraftingJob,
  CraftingStatus,
  CraftingOptions,
  CraftingExtension,
} from "./crafting";

export { boosts } from "./boosts";
export type {
  BoostStacking,
  BoostDef,
  ActiveBoost,
  BoostsOptions,
  BoostsExtension,
} from "./boosts";

export { containers } from "./containers";
export type {
  ContainerContents,
  ContainerDef,
  ContainersData,
  ContainersExtension,
  ContainersOptions,
  DrainInput,
  DrainResult,
} from "./containers";

export { timers } from "./timers";
export type { TimerDef, TimersData, TimersExtension, TimersOptions, TimerState } from "./timers";

export { createPickupsData, pickups } from "./pickups";
export type {
  PickupDef,
  PickupItem,
  PickupPosition,
  PickupsData,
  PickupsExtension,
  PickupsOptions,
  PickupStatus,
  PickupView,
} from "./pickups";
