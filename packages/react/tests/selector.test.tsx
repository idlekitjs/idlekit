// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { createEngine } from "@idlekitjs/core";
import type { Engine } from "@idlekitjs/core";
import { IdleKitProvider, useIdleKitSelector } from "../src";

interface State {
  coins: number;
  gems: number;
}

function makeEngine(initial: State = { coins: 0, gems: 0 }): Engine<State> {
  // Headless engine: no scheduler, driven manually via mutation + flush.
  return createEngine<State>({ initialState: initial });
}

describe("useIdleKitSelector", () => {
  it("reads the initial state", () => {
    const engine = makeEngine({ coins: 42, gems: 0 });

    function Coins() {
      const coins = useIdleKitSelector((state: State) => state.coins);
      return <span data-testid="coins">{coins}</span>;
    }

    render(
      <IdleKitProvider engine={engine}>
        <Coins />
      </IdleKitProvider>,
    );

    expect(screen.getByTestId("coins").textContent).toBe("42");
  });

  it("updates after a state mutation followed by a store flush", () => {
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

    act(() => {
      engine.state.coins = 7;
      engine.store.flush();
    });

    expect(screen.getByTestId("coins").textContent).toBe("7");
  });

  it("updates after engine.advance runs systems, once flushed", () => {
    // step 0.5: exactly representable in binary, so dt sums without drift.
    const engine = createEngine<State>({ initialState: { coins: 0, gems: 0 }, step: 0.5 });
    engine.addSystem((state, dt) => {
      state.coins += dt;
    });

    function Coins() {
      const coins = useIdleKitSelector((state: State) => state.coins);
      return <span data-testid="coins">{coins}</span>;
    }

    render(
      <IdleKitProvider engine={engine}>
        <Coins />
      </IdleKitProvider>,
    );

    act(() => {
      engine.advance(2);
      engine.store.flush();
    });

    expect(screen.getByTestId("coins").textContent).toBe("2");
  });

  it("does not rerender when an unrelated top-level key changes", () => {
    const engine = makeEngine();
    let renders = 0;

    function Coins() {
      renders += 1;
      const coins = useIdleKitSelector((state: State) => state.coins);
      return <span data-testid="coins">{coins}</span>;
    }

    render(
      <IdleKitProvider engine={engine}>
        <Coins />
      </IdleKitProvider>,
    );
    const initialRenders = renders;

    act(() => {
      engine.state.gems = 99;
      engine.store.flush();
    });

    expect(renders).toBe(initialRenders);
    expect(screen.getByTestId("coins").textContent).toBe("0");
  });

  it("uses a custom isEqual to avoid rerenders for equivalent objects", () => {
    const engine = makeEngine({ coins: 1, gems: 2 });
    let renders = 0;

    function Wallet() {
      renders += 1;
      // Fresh object on each run: without isEqual this would rerender on
      // every flush.
      const wallet = useIdleKitSelector(
        (state: State) => ({ coins: state.coins }),
        (a, b) => a.coins === b.coins,
      );
      return <span data-testid="wallet">{wallet.coins}</span>;
    }

    render(
      <IdleKitProvider engine={engine}>
        <Wallet />
      </IdleKitProvider>,
    );
    const initialRenders = renders;

    act(() => {
      engine.state.gems = 3; // flush happens, selected slice is equal
      engine.store.flush();
    });
    expect(renders).toBe(initialRenders);

    act(() => {
      engine.state.coins = 5; // selected slice actually changes
      engine.store.flush();
    });
    expect(renders).toBe(initialRenders + 1);
    expect(screen.getByTestId("wallet").textContent).toBe("5");
  });

  it("does not update without a flush (mutations are batched per frame)", () => {
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

    act(() => {
      engine.state.coins = 9; // no flush
    });

    expect(screen.getByTestId("coins").textContent).toBe("0");
  });
});

describe("top-level-key reactivity caveat (shared with @idlekitjs/dom)", () => {
  interface NestedState {
    resources: { coins: number };
  }

  it("deep mutations do not notify; reassigning the top-level key does", () => {
    const engine = createEngine<NestedState>({
      initialState: { resources: { coins: 0 } },
    });

    function Coins() {
      const coins = useIdleKitSelector((state: NestedState) => state.resources.coins);
      return <span data-testid="coins">{coins}</span>;
    }

    render(
      <IdleKitProvider engine={engine}>
        <Coins />
      </IdleKitProvider>,
    );

    // Deep mutation: the store tracks top-level keys only, so `resources`
    // is never marked dirty and the flush is a no-op.
    act(() => {
      engine.state.resources.coins += 1;
      engine.store.flush();
    });
    expect(screen.getByTestId("coins").textContent).toBe("0");

    // Reassigning the top-level key marks it dirty and notifies.
    act(() => {
      engine.state.resources = { coins: engine.state.resources.coins };
      engine.store.flush();
    });
    expect(screen.getByTestId("coins").textContent).toBe("1");
  });
});
