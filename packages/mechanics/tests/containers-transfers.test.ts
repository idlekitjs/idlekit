import { describe, expect, it } from "vitest";
import { containers } from "../src/containers";
import type { ContainersData, ContainersExtension } from "../src/containers";
import {
  transferBagToContainer,
  transferContainerToBag,
  type BagAccessor,
  type ResourceBag,
} from "../src/containers/economy";

interface TestState {
  stock: ResourceBag;
  storage: ContainersData;
}

const bag: BagAccessor<TestState> = {
  get: (state) => state.stock,
  set: (state, next) => {
    state.stock = next;
  },
};

/** Dock capacity 20; alloy is volume 3, part volume 1. */
function createContainers(): ContainersExtension<TestState> {
  return containers<TestState>({
    definitions: [
      {
        id: "dock",
        capacity: 20,
        volumeOf: (contentId) => (contentId === "alloy" ? 3 : 1),
      },
    ],
    getData: (state) => state.storage,
    setData: (state, data) => {
      state.storage = data;
    },
  });
}

function createState(stock: ResourceBag = {}, storage: ContainersData = {}): TestState {
  return { stock, storage };
}

describe("transferBagToContainer", () => {
  it("moves the whole bag when omitting a request", () => {
    const dock = createContainers();
    const state = createState({ part: 4, alloy: 2 });

    const result = transferBagToContainer(dock, bag, state, "dock");

    expect(result.ok).toBe(true);
    expect(result.moved).toEqual({ part: 4, alloy: 2 });
    expect(result.movedVolume).toBe(4 * 1 + 2 * 3); // 10
    expect(state.stock).toEqual({});
    expect(dock.contents(state, "dock")).toEqual({ part: 4, alloy: 2 });
  });

  it("all-or-nothing moves nothing and leaves no trace when space is short", () => {
    const dock = createContainers();
    // 5 part (5 vol) + 6 alloy (18 vol) = 23 vol > 20 capacity.
    const state = createState({ part: 5, alloy: 6 });

    const result = transferBagToContainer(dock, bag, state, "dock");

    expect(result.ok).toBe(false);
    expect(result.moved).toEqual({});
    expect(result.movedVolume).toBe(0);
    expect(result.blocked?.kind).toBe("insufficient-space");
    // Rolled back: container untouched, bag intact.
    expect(dock.contents(state, "dock")).toEqual({});
    expect(state.stock).toEqual({ part: 5, alloy: 6 });
  });

  it("partial moves as much as fits and leaves the rest in the bag", () => {
    const dock = createContainers();
    const state = createState({ part: 25 }); // 25 vol wanted, 20 capacity (part = vol 1)

    const result = transferBagToContainer(dock, bag, state, "dock", undefined, { mode: "partial" });

    expect(result.ok).toBe(true);
    expect(result.moved).toEqual({ part: 20 });
    expect(result.movedVolume).toBe(20);
    expect(state.stock).toEqual({ part: 5 });
    expect(dock.contents(state, "dock")).toEqual({ part: 20 });
  });

  it("all-or-nothing blocks with missing-source when the bag lacks the request", () => {
    const dock = createContainers();
    const state = createState({ part: 2 });

    const result = transferBagToContainer(dock, bag, state, "dock", { part: 5 });

    expect(result.ok).toBe(false);
    expect(result.blocked).toEqual({
      kind: "missing-source",
      missing: { part: 3 },
      message: expect.any(String),
    });
    expect(state.stock).toEqual({ part: 2 });
    expect(dock.contents(state, "dock")).toEqual({});
  });

  it("reports an unknown container", () => {
    const dock = createContainers();
    const state = createState({ part: 1 });

    const result = transferBagToContainer(dock, bag, state, "missing");

    expect(result.ok).toBe(false);
    expect(result.blocked?.kind).toBe("unknown-container");
  });

  it("reports an empty request when the bag has nothing to give", () => {
    const dock = createContainers();
    const state = createState({});

    const result = transferBagToContainer(dock, bag, state, "dock");

    expect(result.ok).toBe(false);
    expect(result.blocked?.kind).toBe("empty-request");
  });

  it("honours an explicit request smaller than the bag", () => {
    const dock = createContainers();
    const state = createState({ part: 10 });

    const result = transferBagToContainer(dock, bag, state, "dock", { part: 3 });

    expect(result.ok).toBe(true);
    expect(result.moved).toEqual({ part: 3 });
    expect(state.stock).toEqual({ part: 7 });
  });
});

describe("transferContainerToBag", () => {
  it("moves the whole container into the bag by default", () => {
    const dock = createContainers();
    const state = createState({ part: 1 }, { dock: { part: 2, alloy: 1 } });

    const result = transferContainerToBag(dock, bag, state, "dock");

    expect(result.ok).toBe(true);
    expect(result.moved).toEqual({ part: 2, alloy: 1 });
    expect(result.movedVolume).toBe(2 * 1 + 1 * 3); // 5
    expect(state.stock).toEqual({ part: 3, alloy: 1 });
    expect(dock.contents(state, "dock")).toEqual({});
  });

  it("all-or-nothing blocks when the container holds less than requested", () => {
    const dock = createContainers();
    const state = createState({}, { dock: { part: 2 } });

    const result = transferContainerToBag(dock, bag, state, "dock", { part: 5 });

    expect(result.ok).toBe(false);
    expect(result.blocked).toEqual({
      kind: "missing-source",
      missing: { part: 3 },
      message: expect.any(String),
    });
    expect(dock.contents(state, "dock")).toEqual({ part: 2 });
    expect(state.stock).toEqual({});
  });

  it("partial pulls what the container holds, up to the request", () => {
    const dock = createContainers();
    const state = createState({ part: 1 }, { dock: { part: 2 } });

    const result = transferContainerToBag(dock, bag, state, "dock", { part: 5 }, { mode: "partial" });

    expect(result.ok).toBe(true);
    expect(result.moved).toEqual({ part: 2 });
    expect(state.stock).toEqual({ part: 3 });
    expect(dock.contents(state, "dock")).toEqual({});
  });

  it("reports an empty request when the container is empty", () => {
    const dock = createContainers();
    const state = createState({}, { dock: {} });

    const result = transferContainerToBag(dock, bag, state, "dock");

    expect(result.ok).toBe(false);
    expect(result.blocked?.kind).toBe("empty-request");
  });

  it("reports an unknown container", () => {
    const dock = createContainers();
    const state = createState();

    const result = transferContainerToBag(dock, bag, state, "missing");

    expect(result.ok).toBe(false);
    expect(result.blocked?.kind).toBe("unknown-container");
  });
});
