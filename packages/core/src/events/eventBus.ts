import type { EventHandler, EventEmitter } from "@idlekitjs/types";

/**
 * Typed event bus used to decouple systems (achievements, sounds, UI...).
 *
 * The generic `Events` parameter describes the payload shape:
 *   type MyEvents = { resume: number; levelUp: { level: number } };
 *   const bus = new EventBus<MyEvents>();
 */
export class EventBus<
  Events extends Record<string, unknown> = Record<string, unknown>,
> implements EventEmitter<Events> {
  private readonly handlers = new Map<keyof Events, Set<EventHandler<unknown>>>();

  /** Subscribe a handler to an event type. Returns an unsubscribe function. */
  on<K extends keyof Events>(type: K, handler: EventHandler<Events[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as EventHandler<unknown>);
    return () => this.off(type, handler);
  }

  /** Unsubscribe a handler. */
  off<K extends keyof Events>(type: K, handler: EventHandler<Events[K]>): void {
    this.handlers.get(type)?.delete(handler as EventHandler<unknown>);
  }

  /** Emit an event to all subscribed handlers. */
  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const set = this.handlers.get(type);
    if (!set) {
      return;
    }
    for (const handler of [...set]) {
      (handler as EventHandler<Events[K]>)(payload);
    }
  }

  /** Remove every handler (useful for teardown / tests). */
  clear(): void {
    this.handlers.clear();
  }
}
