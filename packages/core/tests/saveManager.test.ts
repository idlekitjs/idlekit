import { describe, it, expect } from "vitest";
import type { SaveAdapter } from "@idlekitjs/types";
import { SaveManager } from "../src/save";

interface State {
  clips: number;
}

/**
 * Minimal in-memory adapter kept local so `core` tests depend only on
 * `@idlekitjs/types` (the concrete adapters live in `@idlekitjs/storage`).
 */
class MemoryAdapter implements SaveAdapter {
  private readonly store = new Map<string, string>();
  read(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  write(key: string, value: string): void {
    this.store.set(key, value);
  }
  remove(key: string): void {
    this.store.delete(key);
  }
}

describe("SaveManager", () => {
  it("saves then reloads the state", async () => {
    const adapter = new MemoryAdapter();
    const manager = new SaveManager<State>({ key: "test", version: 1, adapter });

    await manager.save({ clips: 123 });
    const loaded = await manager.load();

    expect(loaded?.state.clips).toBe(123);
    expect(loaded?.savedAt).toBeGreaterThan(0);
  });

  it("returns null when no save exists", async () => {
    const manager = new SaveManager<State>({
      key: "empty",
      version: 1,
      adapter: new MemoryAdapter(),
    });
    expect(await manager.load()).toBeNull();
  });

  it("returns null on a corrupted save (without throwing)", async () => {
    const adapter = new MemoryAdapter();
    adapter.write("test", "{ this is not json");
    const manager = new SaveManager<State>({ key: "test", version: 1, adapter });
    expect(await manager.load()).toBeNull();
  });

  it("applies migrations up to the current version", async () => {
    const adapter = new MemoryAdapter();
    adapter.write("test", JSON.stringify({ version: 1, savedAt: 1, state: { clips: 10 } }));

    const manager = new SaveManager<State>({
      key: "test",
      version: 2,
      adapter,
      migrations: {
        2: (data) => ({ ...(data as State), clips: (data as State).clips * 2 }),
      },
    });

    const loaded = await manager.load();
    expect(loaded?.state.clips).toBe(20);
  });

  it("neutralizes prototype pollution", async () => {
    const adapter = new MemoryAdapter();
    adapter.write(
      "test",
      '{"version":1,"savedAt":1,"state":{"clips":1,"__proto__":{"polluted":true}}}',
    );
    const manager = new SaveManager<State>({ key: "test", version: 1, adapter });

    await manager.load();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
