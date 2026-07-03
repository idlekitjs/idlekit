import type { EngineEvents, EventEmitter } from "./events";

/**
 * Narrow view of a game exposed to extensions: the surface an extension is
 * allowed to touch, rather than the full engine. The engine's `Engine` implements
 * it, so an extension never depends on the concrete `Engine` class.
 */
export interface EngineContext<T extends object> {
  /** Observable state, to mutate directly. */
  readonly state: T;
  /** Engine event bus (lifecycle events such as `loaded` and `resume`). */
  readonly events: EventEmitter<EngineEvents>;
  /** Advance the simulation by `seconds` (offline catch-up). */
  advance(seconds: number): void;
  /** Suspend frame processing without ending the run (e.g. tab hidden). */
  pause(): void;
  /** Resume after a {@link EngineContext.pause}. */
  resume(): void;
}

/**
 * Engine extension hooked into a game's lifecycle. Anything installable via
 * `engine.use(...)` is an `Extension<T>` — both gameplay primitives
 * (`@idlekitjs/mechanics`) and support add-ons (`@idlekitjs/plugins`).
 *
 * An extension can register (`setup`), take part in the simulation (`update`)
 * and rendering (`render`), and clean up (`teardown`). Every hook is optional:
 * an extension only implements what it needs.
 */
export interface Extension<T extends object> {
  /** Human-readable identifier (diagnostics). */
  id: string;
  /** Called once on registration (`engine.use`). */
  setup?(engine: EngineContext<T>): void;
  /** Called on each fixed time step, after the systems. */
  update?(state: T, dt: number): void;
  /** Called once per frame, after the bindings are rendered. */
  render?(): void;
  /** Called when resources are released (`engine.dispose`). */
  teardown?(): void;
}
