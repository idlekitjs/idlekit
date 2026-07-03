import { describe, it, expect, vi, afterEach } from "vitest";
import type { EngineContext } from "@idlekitjs/core";
import { pageLifecycle } from "../src/page-lifecycle";

interface FakeDoc {
  hidden: boolean;
  addEventListener(type: string, handler: () => void): void;
  removeEventListener(type: string, handler: () => void): void;
  fire(): void;
  readonly hasHandler: boolean;
}

function fakeDocument(): FakeDoc {
  let handler: (() => void) | null = null;
  return {
    hidden: false,
    addEventListener(type, h) {
      if (type === "visibilitychange") handler = h;
    },
    removeEventListener(type) {
      if (type === "visibilitychange") handler = null;
    },
    fire() {
      handler?.();
    },
    get hasHandler() {
      return handler !== null;
    },
  };
}

function fakeEngine() {
  const calls = { pause: 0, resume: 0, resumeEvents: [] as number[] };
  const engine = {
    state: {},
    advance: () => {},
    pause: () => {
      calls.pause += 1;
    },
    resume: () => {
      calls.resume += 1;
    },
    events: {
      on: () => () => {},
      off: () => {},
      emit: (type: string, payload: number) => {
        if (type === "resume") calls.resumeEvents.push(payload);
      },
    },
  };
  return { engine: engine as unknown as EngineContext<object>, calls };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("pageLifecycle()", () => {
  it("is a no-op without a document (SSR/headless): setup/teardown do not throw", () => {
    // vitest's default env is node: `document` is undefined here.
    const ext = pageLifecycle<object>();
    const { engine } = fakeEngine();
    expect(() => ext.setup?.(engine)).not.toThrow();
    expect(() => ext.teardown?.()).not.toThrow();
  });

  it("pauses on hidden and emits resume(elapsed) then resumes on visible", () => {
    const doc = fakeDocument();
    vi.stubGlobal("document", doc);
    vi.spyOn(Date, "now").mockReturnValueOnce(1000).mockReturnValueOnce(4000);

    const ext = pageLifecycle<object>();
    const { engine, calls } = fakeEngine();
    ext.setup?.(engine);
    expect(doc.hasHandler).toBe(true);

    doc.hidden = true;
    doc.fire(); // Date.now() -> 1000
    expect(calls.pause).toBe(1);
    expect(calls.resumeEvents).toEqual([]);

    doc.hidden = false;
    doc.fire(); // Date.now() -> 4000, elapsed 3000ms
    expect(calls.resumeEvents).toEqual([3000]);
    expect(calls.resume).toBe(1);
  });

  it("handles several hidden/visible cycles", () => {
    const doc = fakeDocument();
    vi.stubGlobal("document", doc);
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1100)
      .mockReturnValueOnce(2000)
      .mockReturnValueOnce(2200);

    const ext = pageLifecycle<object>();
    const { engine, calls } = fakeEngine();
    ext.setup?.(engine);

    doc.hidden = true;
    doc.fire(); // hiddenAt 0
    doc.hidden = false;
    doc.fire(); // elapsed 100
    doc.hidden = true;
    doc.fire(); // hiddenAt 500
    doc.hidden = false;
    doc.fire(); // elapsed 200

    expect(calls.resumeEvents).toEqual([100, 200]);
    expect(calls.pause).toBe(2);
    expect(calls.resume).toBe(2);
  });

  it("removes the listener on teardown", () => {
    const doc = fakeDocument();
    vi.stubGlobal("document", doc);
    const ext = pageLifecycle<object>();
    const { engine } = fakeEngine();
    ext.setup?.(engine);
    expect(doc.hasHandler).toBe(true);
    ext.teardown?.();
    expect(doc.hasHandler).toBe(false);
  });
});
