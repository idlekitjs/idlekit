/**
 * @idlekitjs/types - Framework-agnostic type contracts shared across @idlekitjs
 * packages. No runtime code: the concrete implementations live in @idlekitjs/core.
 */
export type { StateKey, FlushListener } from "./state";
export type { EventHandler, EventEmitter, EngineEvents } from "./events";
export type { System } from "./system";
export type { EngineContext, Extension } from "./extension";
export type { SaveAdapter, Migration, LoadResult } from "./save";
export type { Binding } from "./ui";
