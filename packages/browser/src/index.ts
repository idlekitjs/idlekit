/**
 * @idlekitjs/browser - browser runtime bridges for @idlekitjs games.
 *
 * Each brick connects one browser API to an engine contract, keeping
 * `@idlekitjs/core` headless: the engine only knows `FrameScheduler`,
 * `pause()`/`resume()` and its typed events — this package produces them from
 * `requestAnimationFrame`, the Page Visibility API and `window` display info.
 *
 * Not rendering: the DOM renderer and bindings live in `@idlekitjs/dom`.
 *
 * Prefer the subpath imports for lean bundles:
 *
 *   import { pageLifecycle } from "@idlekitjs/browser/page-lifecycle";
 *   import { createRafScheduler } from "@idlekitjs/browser/raf-scheduler";
 *   import { devicePixelRatio } from "@idlekitjs/browser/screen";
 */
export { pageLifecycle } from "./page-lifecycle";
export { createRafScheduler } from "./raf-scheduler";
export { devicePixelRatio, cssToDevicePx, deviceToCssPx } from "./screen";
