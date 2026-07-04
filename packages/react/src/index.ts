/**
 * @idlekitjs/react - React bindings for @idlekitjs engines.
 *
 * The React sibling of `@idlekitjs/dom`: a thin bridge from React components to
 * the core engine's state and events. It contains reactivity glue only —
 * context, hooks, subscriptions — and no game, economy, storage, or browser
 * scheduling logic. The engine is created, started, and disposed by the app
 * (`createEngine` from `@idlekitjs/core`); this package never owns its
 * lifecycle.
 *
 * Nothing from `@idlekitjs/core` is re-exported: import engine APIs from
 * `@idlekitjs/core` directly.
 */

// Provider
export { IdleKitProvider } from "./provider";

// Hooks
export { useIdleKitEngine, useIdleKitSelector, useIdleKitEvent } from "./hooks";

// Note: `src/internal/` (context object, store version counter) is
// implementation glue and is intentionally not exported.
