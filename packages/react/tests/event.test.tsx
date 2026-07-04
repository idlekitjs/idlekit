// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { createEngine } from "@idlekitjs/core";
import type { Engine } from "@idlekitjs/core";
import { IdleKitProvider, useIdleKitEvent } from "../src";

interface State {
  coins: number;
}

function makeEngine(): Engine<State> {
  return createEngine<State>({ initialState: { coins: 0 } });
}

describe("useIdleKitEvent", () => {
  it("subscribes to an engine event and receives payloads", () => {
    const engine = makeEngine();
    const received: number[] = [];

    function Listener() {
      useIdleKitEvent("loaded", (savedAt) => {
        received.push(savedAt);
      });
      return null;
    }

    render(
      <IdleKitProvider engine={engine}>
        <Listener />
      </IdleKitProvider>,
    );

    act(() => {
      engine.events.emit("loaded", 123);
    });

    expect(received).toEqual([123]);
  });

  it("unsubscribes on unmount", () => {
    const engine = makeEngine();
    const received: number[] = [];

    function Listener() {
      useIdleKitEvent("loaded", (savedAt) => {
        received.push(savedAt);
      });
      return null;
    }

    const { unmount } = render(
      <IdleKitProvider engine={engine}>
        <Listener />
      </IdleKitProvider>,
    );
    unmount();

    act(() => {
      engine.events.emit("loaded", 456);
    });

    expect(received).toEqual([]);
  });

  it("uses the latest handler without resubscribing", () => {
    const engine = makeEngine();
    const onSpy = vi.spyOn(engine.events, "on");
    const first = vi.fn();
    const second = vi.fn();

    function Listener({ handler }: { handler: (savedAt: number) => void }) {
      useIdleKitEvent("loaded", handler);
      return null;
    }

    const { rerender } = render(
      <IdleKitProvider engine={engine}>
        <Listener handler={first} />
      </IdleKitProvider>,
    );
    const subscriptions = onSpy.mock.calls.length;

    rerender(
      <IdleKitProvider engine={engine}>
        <Listener handler={second} />
      </IdleKitProvider>,
    );

    // A new handler identity must not resubscribe...
    expect(onSpy.mock.calls.length).toBe(subscriptions);

    // ...but the latest handler is the one invoked.
    act(() => {
      engine.events.emit("loaded", 789);
    });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(789);

    onSpy.mockRestore();
  });
});
