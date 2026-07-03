import { describe, it, expect } from "vitest";
import { createEngine } from "../src/engine";

describe("Engine.use (plugin lifecycle)", () => {
  it("calls setup on registration and update on each step", () => {
    const engine = createEngine<{ ticks: number }>({ initialState: { ticks: 0 }, step: 1 });
    let setupCalled = false;

    engine.use({
      id: "counter",
      setup: () => {
        setupCalled = true;
      },
      update: (state) => {
        state.ticks += 1;
      },
    });

    expect(setupCalled).toBe(true);
    // advance runs `step`-sized steps: 3 s / 1 s => 3 updates.
    engine.advance(3);
    expect(engine.state.ticks).toBe(3);
  });

  it("releases plugins via dispose()", () => {
    const engine = createEngine<{ value: number }>({ initialState: { value: 0 } });
    let teardownCalled = false;

    engine.use({
      id: "with-teardown",
      teardown: () => {
        teardownCalled = true;
      },
    });

    engine.dispose();
    expect(teardownCalled).toBe(true);
  });
});
