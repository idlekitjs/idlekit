/**
 * @idlekitjs/devtools - development tools for @idlekitjs games.
 *
 * Register `devtools()` as a plugin to get a live debug overlay (frame rate,
 * tick rate, uptime, custom stats) with quick "Save now" and "Wipe data"
 * actions. It is a no-op outside the browser; gate it behind a dev flag to keep
 * it out of production builds.
 */
export { devtools } from "./devtools";
export type { DevtoolsOptions, DevtoolsExtension } from "./devtools";
export { DevMetrics } from "./metrics";
