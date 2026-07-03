import { describe, it, expect, vi } from "vitest";
import { EventBus } from "../src/events";

interface TestEvents extends Record<string, unknown> {
  ping: number;
}

describe("EventBus", () => {
  it("calls subscribed handlers with the payload", () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();
    bus.on("ping", handler);
    bus.emit("ping", 42);
    expect(handler).toHaveBeenCalledWith(42);
  });

  it("unsubscribes via the returned function", () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();
    const off = bus.on("ping", handler);
    off();
    bus.emit("ping", 1);
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not fail when no handler is subscribed", () => {
    const bus = new EventBus<TestEvents>();
    expect(() => bus.emit("ping", 1)).not.toThrow();
  });

  it("removes every handler with clear()", () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();
    bus.on("ping", handler);
    bus.clear();
    bus.emit("ping", 1);
    expect(handler).not.toHaveBeenCalled();
  });

  it("tolerates a handler unsubscribing during emit", () => {
    const bus = new EventBus<TestEvents>();
    const calls: string[] = [];
    const off = bus.on("ping", () => {
      calls.push("a");
      off();
    });
    bus.on("ping", () => calls.push("b"));

    expect(() => bus.emit("ping", 1)).not.toThrow();
    expect(calls).toEqual(["a", "b"]);
  });
});
