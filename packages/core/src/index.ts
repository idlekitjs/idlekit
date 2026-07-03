/**
 * @idlekitjs/core - Public API of the incremental games engine.
 *
 * The engine-level contracts live in @idlekitjs/types and are re-exported here so
 * games can import everything engine-related from a single facade. Types owned
 * by mechanics/plugins/dom/storage are NOT re-exported: import them from their
 * own package (e.g. `Project` from @idlekitjs/mechanics/projects, `Binding` from
 * @idlekitjs/dom).
 */

// Engine-level contracts (defined in @idlekitjs/types)
export type {
  System,
  Extension,
  EngineContext,
  EngineEvents,
  EventHandler,
  EventEmitter,
  SaveAdapter,
  Migration,
  LoadResult,
  StateKey,
  FlushListener,
} from "@idlekitjs/types";

// Orchestrator
export { Engine, createEngine } from "./engine";
export type { EngineConfig, RenderTarget } from "./engine";

// Reactive state
export { ReactiveStore } from "./state";

// Simulation loop
export { SimulationLoop, manualScheduler } from "./loop";
export type { SimulationLoopOptions, FrameScheduler, ManualFrameScheduler } from "./loop";

// Events
export { EventBus } from "./events";

// Saving (storage backends live in @idlekitjs/storage)
export { SaveManager } from "./save";
export type { SaveManagerOptions } from "./save";

// Numbers
export { Decimal, D } from "./numbers";
export type { DecimalSource } from "./numbers";

// Randomness (seedable, serializable)
export { Random, createRandom } from "./random";

// Formatting
export { formatNumber, formatInteger, formatDuration } from "./format";

// Note: the DOM renderer and bindings live in @idlekitjs/dom (core is headless).
