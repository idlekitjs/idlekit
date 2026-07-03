/**
 * `autosave` plugin: periodic + lifecycle-driven saving (@idlekitjs/plugins/autosave).
 *
 * `SaveScheduler` is the reusable scheduling core behind `autosave`. It is
 * surfaced only through this module, never as its own subpath.
 *
 * Known boundary exception: the saving *policy* is platform-agnostic, but the
 * default triggers still touch browser APIs (`window.setInterval`,
 * `visibilitychange`, `pagehide`), so this plugin currently assumes a browser.
 * Future target: consume generic engine events produced by
 * `@idlekitjs/browser/page-lifecycle` (and later runtime packages such as
 * capacitor/electron), making autosave a pure engine policy.
 */
export { autosave } from "./extension";
export type { AutosaveOptions } from "./extension";
export { SaveScheduler } from "./scheduler";
export type { SaveSchedulerOptions } from "./scheduler";
