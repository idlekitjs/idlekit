import { describe, it, expect, vi } from "vitest";
import { ReactiveStore } from "../src/state";

describe("ReactiveStore", () => {
  it("does not mark a key dirty if the value does not change", () => {
    const store = new ReactiveStore({ clips: 5 });
    store.state.clips = 5;
    expect(store.isDirty).toBe(false);
  });

  it("marks a key dirty when the value changes", () => {
    const store = new ReactiveStore({ clips: 0 });
    store.state.clips = 1;
    expect(store.isDirty).toBe(true);
  });

  it("notifies subscribers with the changed keys on flush", () => {
    const store = new ReactiveStore({ clips: 0, funds: 0 });
    const listener = vi.fn();
    store.subscribe(listener);

    store.state.clips = 10;
    store.flush();

    expect(listener).toHaveBeenCalledTimes(1);
    const dirtyKeys = listener.mock.calls[0][0] as ReadonlySet<string>;
    expect(dirtyKeys.has("clips")).toBe(true);
    expect(dirtyKeys.has("funds")).toBe(false);
  });

  it("resets tracking after a flush", () => {
    const store = new ReactiveStore({ clips: 0 });
    store.state.clips = 1;
    store.flush();
    expect(store.isDirty).toBe(false);
  });

  it("does not notify if nothing changed", () => {
    const store = new ReactiveStore({ clips: 0 });
    const listener = vi.fn();
    store.subscribe(listener);
    store.flush();
    expect(listener).not.toHaveBeenCalled();
  });

  it("allows unsubscribing", () => {
    const store = new ReactiveStore({ clips: 0 });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.state.clips = 1;
    store.flush();
    expect(listener).not.toHaveBeenCalled();
  });

  it("collects keys read during track()", () => {
    const store = new ReactiveStore({ a: 1, b: 2, c: 3 });
    const deps = new Set<string | symbol>();
    store.track(deps, () => {
      void store.state.a;
      void store.state.c;
    });
    expect(deps.has("a")).toBe(true);
    expect(deps.has("c")).toBe(true);
    expect(deps.has("b")).toBe(false);
  });

  it("stops collecting after track() returns", () => {
    const store = new ReactiveStore({ a: 1 });
    const deps = new Set<string | symbol>();
    store.track(deps, () => undefined);
    void store.state.a;
    expect(deps.has("a")).toBe(false);
  });

  it("returns the value produced by the tracked function", () => {
    const store = new ReactiveStore({ a: 5 });
    const deps = new Set<string | symbol>();
    const result = store.track(deps, () => store.state.a * 2);
    expect(result).toBe(10);
  });

  it("restores the previous collector even if the function throws", () => {
    const store = new ReactiveStore({ a: 1 });
    const deps = new Set<string | symbol>();
    expect(() =>
      store.track(deps, () => {
        throw new Error("boom");
      }),
    ).toThrow("boom");
    // after an exception, tracking must not stay active
    void store.state.a;
    expect(deps.has("a")).toBe(false);
  });
});
