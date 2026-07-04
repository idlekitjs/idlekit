// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { render, renderHook, screen } from "@testing-library/react";
import { createEngine } from "@idlekitjs/core";
import type { Engine } from "@idlekitjs/core";
import { IdleKitProvider, useIdleKitEngine, useIdleKitSelector } from "../src";

interface State {
  coins: number;
}

function makeEngine(): Engine<State> {
  return createEngine<State>({ initialState: { coins: 0 } });
}

describe("IdleKitProvider / useIdleKitEngine", () => {
  it("provides the engine instance to descendants, unchanged", () => {
    const engine = makeEngine();
    let received: Engine<State> | null = null;

    function Probe(): null {
      received = useIdleKitEngine<State>();
      return null;
    }

    render(
      <IdleKitProvider engine={engine}>
        <Probe />
      </IdleKitProvider>,
    );

    expect(received).toBe(engine);
  });

  it("lets handlers mutate state through the engine", () => {
    const engine = makeEngine();

    function Coins() {
      const coins = useIdleKitSelector((state: State) => state.coins);
      return <span data-testid="coins">{coins}</span>;
    }

    render(
      <IdleKitProvider engine={engine}>
        <Coins />
      </IdleKitProvider>,
    );

    expect(screen.getByTestId("coins").textContent).toBe("0");
  });

  it("useIdleKitEngine throws a descriptive error outside a provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useIdleKitEngine())).toThrow(
      "useIdleKitEngine must be used within an IdleKitProvider.",
    );
    spy.mockRestore();
  });

  it("useIdleKitSelector throws a descriptive error outside a provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useIdleKitSelector((state: State) => state.coins))).toThrow(
      "useIdleKitSelector must be used within an IdleKitProvider.",
    );
    spy.mockRestore();
  });
});
