import { ReactiveStore } from "./state";
import { EventBus } from "./events";
import { SimulationLoop } from "./loop";
import type { FrameScheduler } from "./loop";
import type { System, Extension, EngineContext, EngineEvents } from "@idlekitjs/types";
import type { SaveManager } from "./save";

/**
 * Minimal view surface the engine drives. Kept headless: the DOM `Renderer`
 * lives in `@idlekitjs/dom` and is injected via {@link EngineConfig.renderer}. Any
 * object exposing `connect`/`render` (e.g. a canvas or native renderer) fits.
 */
export interface RenderTarget<T extends object> {
  connect(store: ReactiveStore<T>): void;
  render(): void;
}

export interface EngineConfig<T extends object> {
  /** Initial state (plain data object, serializable). */
  initialState: T;
  /** Fixed time step in seconds (default: 1/20 s). */
  step?: number;
  /**
   * Optional renderer, injected by the game. Omitted for headless runs (tests,
   * server). When present it is connected to the store and refreshed each frame.
   */
  renderer?: RenderTarget<T>;
  /**
   * Optional frame driver. Games inject `createRafScheduler()` from
   * `@idlekitjs/browser`; omitted (headless default) means `start()` will not tick on
   * its own — drive the simulation with `advance()` instead.
   */
  scheduler?: FrameScheduler;
}

/**
 * Orchestrator: wires together the reactive state, the loop, the systems and
 * the event bus. The engine is headless and knows no business rule: it runs the
 * systems provided by the game on each tick and refreshes the injected renderer,
 * if any.
 */
export class Engine<T extends object> implements EngineContext<T> {
  readonly store: ReactiveStore<T>;
  readonly events = new EventBus<EngineEvents>();

  private readonly renderer?: RenderTarget<T>;
  private readonly loop: SimulationLoop;
  private readonly step: number;
  private readonly systems: System<T>[] = [];
  private readonly extensions: Extension<T>[] = [];

  constructor(config: EngineConfig<T>) {
    this.store = new ReactiveStore(config.initialState);
    this.renderer = config.renderer;
    this.renderer?.connect(this.store);
    this.step = config.step ?? 1 / 20;
    this.loop = new SimulationLoop({
      step: this.step,
      update: (dt) => this.update(dt),
      render: () => this.render(),
      scheduler: config.scheduler,
    });
  }

  /** Observable state, to mutate directly. */
  get state(): T {
    return this.store.state;
  }

  /** Register a system run on each time step. Chainable. */
  addSystem(system: System<T>): this {
    this.systems.push(system);
    return this;
  }

  /** Register an extension and call its `setup` immediately. Chainable. */
  use(extension: Extension<T>): this {
    this.extensions.push(extension);
    extension.setup?.(this);
    return this;
  }

  /**
   * Load a save into the state, then emit `loaded` (with `savedAt`). Extensions
   * (offline progress, projects...) react to this event.
   */
  async load(save: SaveManager<T>): Promise<boolean> {
    const result = await save.load();
    if (!result) {
      return false;
    }
    Object.assign(this.state, result.state);
    this.events.emit("loaded", result.savedAt);
    return true;
  }

  start(): void {
    this.loop.start();
  }

  stop(): void {
    this.loop.stop();
  }

  /** Suspend frame processing without ending the run (e.g. tab hidden). */
  pause(): void {
    this.loop.pause();
  }

  /** Resume after a {@link pause}. */
  resume(): void {
    this.loop.resume();
  }

  /** Stop the loop and release the extensions. */
  dispose(): void {
    this.stop();
    for (const extension of this.extensions) {
      extension.teardown?.();
    }
  }

  /**
   * Advance the simulation by `seconds` (offline progress) by running fixed
   * steps of `step`, exactly as in real time, plus a final partial step for the
   * remainder. Essential: the mechanics are non-linear (thresholds, caps,
   * produce -> sell -> rebuy feedback loops) and a single pass with a large `dt`
   * would distort them.
   *
   * Capping the offline time stays the caller's responsibility (each game has
   * its own policy).
   */
  advance(seconds: number): void {
    if (seconds <= 0) {
      return;
    }
    let remaining = seconds;
    while (remaining > 1e-9) {
      const dt = remaining < this.step ? remaining : this.step;
      this.update(dt);
      remaining -= dt;
    }
  }

  private update(dt: number): void {
    for (const system of this.systems) {
      system(this.state, dt);
    }
    for (const extension of this.extensions) {
      extension.update?.(this.state, dt);
    }
  }

  private render(): void {
    this.store.flush();
    this.renderer?.render();
    for (const extension of this.extensions) {
      extension.render?.();
    }
  }
}

export function createEngine<T extends object>(config: EngineConfig<T>): Engine<T> {
  return new Engine<T>(config);
}
