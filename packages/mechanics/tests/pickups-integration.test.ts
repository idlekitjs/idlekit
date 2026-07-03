import { describe, expect, it } from "vitest";
import { createEconomy, stateKey } from "@idlekitjs/economy";
import { containers, type ContainersData } from "../src/containers";
import { containerHasSpace } from "../src/containers/economy";
import { createPickupsData, pickups, type PickupsData } from "../src/pickups";
import { collectPickup } from "../src/pickups/economy";
import { timers, type TimersData } from "../src/timers";

/**
 * Full composition dogfood — the "waste collection" scenario expressed with
 * generic primitives:
 * - a pickup type spawns periodically and expires if ignored;
 * - collecting is an economy transaction gated by container space;
 * - a successful collect fills the container and rewards money;
 * - a timer periodically drains the container.
 *
 * Boundaries under test: spawning never rewards; a full container blocks the
 * collect without mutating; the drain frees space and collects resume.
 */

interface GameState {
  money: number;
  pickups: PickupsData;
  storage: ContainersData;
  timers: TimersData;
}

function createGame() {
  const state: GameState = {
    money: 0,
    pickups: createPickupsData(7),
    storage: { bin: {} },
    timers: {},
  };

  const economy = createEconomy<GameState>().resource({
    id: "currency:money",
    accessor: stateKey("money"),
  });

  const litter = pickups<GameState>({
    definitions: [
      { id: "scrap", lifetime: 30, spawn: { every: 5, max: 4 }, metadata: { image: "scrap.gif" } },
    ],
    getData: (s) => s.pickups,
    setData: (s, data) => {
      s.pickups = data;
    },
  });

  const bin = containers<GameState>({
    definitions: [{ id: "bin", capacity: 2 }],
    getData: (s) => s.storage,
    setData: (s, data) => {
      s.storage = data;
    },
  });

  const routines = timers<GameState>({
    definitions: [{ id: "truck", every: 20 }],
    getData: (s) => s.timers,
    setData: (s, data) => {
      s.timers = data;
    },
    onFire: (id, s, fires) => {
      if (id !== "truck") {
        return;
      }
      for (let i = 0; i < fires; i++) {
        bin.drain(s, "bin");
      }
    },
  });

  const tick = (dt: number): void => {
    litter.update?.(state, dt);
    bin.update?.(state, dt);
    routines.update?.(state, dt);
  };

  const collect = (itemId: string) =>
    economy.execute(
      state,
      collectPickup(litter, {
        itemId,
        reward: [["currency:money", 5]],
        requirements: [containerHasSpace(bin, "bin", "scrap")],
        apply: (s) => {
          bin.fill(s, "bin", "scrap");
        },
      }),
    );

  return { state, economy, litter, bin, routines, tick, collect };
}

describe("pickups + containers + timers + economy", () => {
  it("plays the full loop: spawn, collect, block on full, drain, resume", () => {
    const game = createGame();

    // Spawn phase: opportunities appear, nothing is rewarded.
    game.tick(10); // 2 spawns
    expect(game.litter.active(game.state, "scrap")).toBe(2);
    expect(game.state.money).toBe(0);

    // Collect both: money only flows on successful collects.
    const [first, second] = game.litter.visible(game.state);
    expect(game.collect(first.id).ok).toBe(true);
    expect(game.collect(second.id).ok).toBe(true);
    expect(game.state.money).toBe(10);
    expect(game.bin.used(game.state, "bin")).toBe(2);

    // Bin full: the next collect fails cleanly and the pickup stays.
    game.tick(5); // 1 more spawn
    const [third] = game.litter.visible(game.state);
    const blocked = game.collect(third.id);
    expect(blocked.ok).toBe(false);
    expect(game.state.money).toBe(10);
    expect(game.litter.status(game.state, third.id).kind).toBe("ready");

    // The truck passes (timer fires at t=20), draining the bin; the third
    // pickup (spawned at t=15, lifetime 30) is still alive and collectable.
    game.tick(20);
    expect(game.bin.used(game.state, "bin")).toBe(0);
    const stillThere = game.litter.visible(game.state).find((view) => view.id === third.id);
    expect(stillThere).toBeDefined();
    expect(game.collect(third.id).ok).toBe(true);
    expect(game.state.money).toBe(15);
  });

  it("ignored pickups expire without ever granting anything", () => {
    const game = createGame();
    game.tick(5); // one spawn (lifetime 30)
    expect(game.litter.active(game.state, "scrap")).toBe(1);
    game.tick(31); // expires; further spawns replace it, older one is gone
    expect(game.state.money).toBe(0);
    expect(game.bin.used(game.state, "bin")).toBe(0);
  });
});
