/** Handler for a typed event payload. */
export type EventHandler<P> = (payload: P) => void;

/**
 * Minimal typed event emitter contract. The engine's `EventBus` implements it;
 * plugins depend on this interface rather than on the concrete class.
 */
export interface EventEmitter<Events extends Record<string, unknown>> {
  /** Subscribe a handler to an event type. Returns an unsubscribe function. */
  on<K extends keyof Events>(type: K, handler: EventHandler<Events[K]>): () => void;
  /** Unsubscribe a handler. */
  off<K extends keyof Events>(type: K, handler: EventHandler<Events[K]>): void;
  /** Emit an event to all subscribed handlers. */
  emit<K extends keyof Events>(type: K, payload: Events[K]): void;
}

/** Events emitted by the engine, extensible per game. */
export interface EngineEvents extends Record<string, unknown> {
  /** Returned from the background: elapsed offline time in milliseconds. */
  resume: number;
  /** A save was just loaded: the `savedAt` timestamp in milliseconds. */
  loaded: number;
}
