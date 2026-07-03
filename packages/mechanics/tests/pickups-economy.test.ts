import { describe, expect, it } from "vitest";
import { createEconomy, stateKey, type Economy } from "@idlekitjs/economy";
import { createPickupsData, pickups } from "../src/pickups";
import type { PickupsData, PickupsExtension } from "../src/pickups";
import { collectPickup, pickupAvailable } from "../src/pickups/economy";
import { containers } from "../src/containers";
import type { ContainersData } from "../src/containers";
import { containerHasSpace } from "../src/containers/economy";

interface TestState {
  money: number;
  pickups: PickupsData;
  storage: ContainersData;
}

function createState(): TestState {
  return { money: 0, pickups: createPickupsData(1), storage: { bin: {} } };
}

function createPickups(): PickupsExtension<TestState> {
  return pickups<TestState>({
    definitions: [{ id: "scrap", lifetime: 10 }],
    getData: (state) => state.pickups,
    setData: (state, data) => {
      state.pickups = data;
    },
  });
}

function createTestEconomy(): Economy<TestState> {
  return createEconomy<TestState>().resource({
    id: "currency:money",
    accessor: stateKey("money"),
  });
}

describe("pickupAvailable", () => {
  it("is met only while the item is ready", () => {
    const plugin = createPickups();
    const economy = createTestEconomy();
    const state = createState();
    const item = plugin.spawn(state, "scrap")!;

    expect(pickupAvailable(plugin, item.id).isMet(state, economy)).toBe(true);
    expect(pickupAvailable(plugin, "nope").isMet(state, economy)).toBe(false);
    plugin.update?.(state, 11); // expire it
    expect(pickupAvailable(plugin, item.id).isMet(state, economy)).toBe(false);
  });
});

describe("collectPickup", () => {
  it("spawning grants nothing; the reward exists only on successful collect", () => {
    const plugin = createPickups();
    const economy = createTestEconomy();
    const state = createState();
    const item = plugin.spawn(state, "scrap")!;
    expect(state.money).toBe(0); // no reward on spawn

    const result = economy.execute(
      state,
      collectPickup(plugin, { itemId: item.id, reward: [["currency:money", 5]] }),
    );
    expect(result.ok).toBe(true);
    expect(state.money).toBe(5);
    expect(plugin.status(state, item.id).kind).toBe("unknown"); // taken
  });

  it("a failed requirement leaves the pickup in place and credits nothing", () => {
    const plugin = createPickups();
    const economy = createTestEconomy();
    const state = createState();
    const item = plugin.spawn(state, "scrap")!;

    const result = economy.execute(
      state,
      collectPickup(plugin, {
        itemId: item.id,
        reward: [["currency:money", 5]],
        requirements: [{ id: "never", isMet: () => false }],
      }),
    );
    expect(result.ok).toBe(false);
    expect(state.money).toBe(0);
    expect(plugin.status(state, item.id).kind).toBe("ready");
  });

  it("collecting an expired or unknown item fails with a requirement diagnostic", () => {
    const plugin = createPickups();
    const economy = createTestEconomy();
    const state = createState();
    const item = plugin.spawn(state, "scrap")!;
    plugin.update?.(state, 11);

    const result = economy.execute(state, collectPickup(plugin, { itemId: item.id }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failures[0]).toMatchObject({
        kind: "requirement-failed",
        requirementId: `pickup-available:${item.id}`,
      });
    }
  });

  it("composes with containerHasSpace: full container blocks the collect", () => {
    const plugin = createPickups();
    const economy = createTestEconomy();
    const state = createState();
    const bin = containers<TestState>({
      definitions: [{ id: "bin", capacity: 1 }],
      getData: (s) => s.storage,
      setData: (s, data) => {
        s.storage = data;
      },
    });

    const collect = (itemId: string) =>
      collectPickup(plugin, {
        itemId,
        reward: [["currency:money", 5]],
        requirements: [containerHasSpace(bin, "bin", "scrap")],
        apply: (s) => {
          bin.fill(s, "bin", "scrap");
        },
      });

    const first = plugin.spawn(state, "scrap")!;
    const second = plugin.spawn(state, "scrap")!;
    expect(economy.execute(state, collect(first.id)).ok).toBe(true);
    expect(state.money).toBe(5);

    // Bin now full: the second collect fails cleanly, nothing moves.
    const blocked = economy.execute(state, collect(second.id));
    expect(blocked.ok).toBe(false);
    expect(state.money).toBe(5);
    expect(plugin.status(state, second.id).kind).toBe("ready");
    expect(bin.contents(state, "bin")).toEqual({ scrap: 1 });
  });

  it("runs the optional apply with the taken item and supports a cost", () => {
    const plugin = createPickups();
    const economy = createTestEconomy();
    const state = createState();
    state.money = 3;
    const item = plugin.spawn(state, "scrap")!;
    let appliedId: string | undefined;

    const result = economy.execute(
      state,
      collectPickup(plugin, {
        itemId: item.id,
        cost: [["currency:money", 2]],
        reward: [["currency:money", 10]],
        apply: (_state, taken) => {
          appliedId = taken.id;
        },
      }),
    );
    expect(result.ok).toBe(true);
    expect(appliedId).toBe(item.id);
    expect(state.money).toBe(11); // 3 - 2 + 10
  });
});
