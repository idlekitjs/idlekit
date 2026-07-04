// @vitest-environment happy-dom
import { StrictMode } from "react";
import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { createEngine } from "@idlekitjs/core";
import type { Engine } from "@idlekitjs/core";
import { IdleKitProvider, useIdleKitSelector, useIdleKitEvent } from "../src";

interface State {
  coins: number;
}

function makeEngine(): Engine<State> {
  return createEngine<State>({ initialState: { coins: 0 } });
}

describe("Strict Mode", () => {
  it("selector survives the double mount/unmount/remount of effects", () => {
    const engine = makeEngine();

    function Coins() {
      const coins = useIdleKitSelector((state: State) => state.coins);
      return <span data-testid="coins">{coins}</span>;
    }

    render(
      <StrictMode>
        <IdleKitProvider engine={engine}>
          <Coins />
        </IdleKitProvider>
      </StrictMode>,
    );

    act(() => {
      engine.state.coins = 11;
      engine.store.flush();
    });

    expect(screen.getByTestId("coins").textContent).toBe("11");
  });

  it("event handlers fire exactly once per emit (no leaked subscription)", () => {
    const engine = makeEngine();
    const received: number[] = [];

    function Listener() {
      useIdleKitEvent("loaded", (savedAt) => {
        received.push(savedAt);
      });
      return null;
    }

    const { unmount } = render(
      <StrictMode>
        <IdleKitProvider engine={engine}>
          <Listener />
        </IdleKitProvider>
      </StrictMode>,
    );

    act(() => {
      engine.events.emit("loaded", 1);
    });
    // Strict Mode mounted effects twice, but cleanup ran in between: one call.
    expect(received).toEqual([1]);

    unmount();
    act(() => {
      engine.events.emit("loaded", 2);
    });
    expect(received).toEqual([1]);
  });

  it("a full unmount/remount cycle keeps subscriptions working", () => {
    const engine = makeEngine();

    function Coins() {
      const coins = useIdleKitSelector((state: State) => state.coins);
      return <span data-testid="coins">{coins}</span>;
    }

    const ui = (
      <StrictMode>
        <IdleKitProvider engine={engine}>
          <Coins />
        </IdleKitProvider>
      </StrictMode>
    );

    const first = render(ui);
    first.unmount();

    render(ui);
    act(() => {
      engine.state.coins = 21;
      engine.store.flush();
    });

    expect(screen.getByTestId("coins").textContent).toBe("21");
  });
});
