/**
 * @idlekitjs/plugins - platform-agnostic engine policies for @idlekitjs.
 *
 * Each factory returns an `Extension<T>` installable via `engine.use(...)`. Unlike
 * `@idlekitjs/mechanics`, these are not gameplay primitives: they are operational
 * policies (saving, offline catch-up, ...) that consume engine contracts and
 * events — never platform APIs. Platform bridges live in `@idlekitjs/browser`.
 *
 * Known exception: `autosave`'s default triggers still touch browser APIs
 * (`setInterval`, `visibilitychange`, `pagehide`); see its module doc.
 *
 * Usage: `engine.use(autosave({ ... }))`.
 */
export { autosave, SaveScheduler } from "./autosave";
export type { AutosaveOptions, SaveSchedulerOptions } from "./autosave";
export { offlineProgress } from "./offline-progress";
export type { OfflineProgressOptions } from "./offline-progress";
