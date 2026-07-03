import type { SaveAdapter, Migration, LoadResult } from "@idlekitjs/types";

export interface SaveManagerOptions {
  /** Storage key. */
  key: string;
  /** Current schema version. */
  version: number;
  /** Persistence backend. */
  adapter: SaveAdapter;
  /**
   * Migrations indexed by target version: `migrations[n]` upgrades a save from
   * version `n - 1` to version `n`.
   */
  migrations?: Record<number, Migration>;
}

interface SavePayload {
  version: number;
  savedAt: number;
  state: unknown;
}

/**
 * JSON reviver that neutralizes prototype pollution: a hand-edited save cannot
 * inject `__proto__` / `constructor`.
 */
function safeReviver(key: string, value: unknown): unknown {
  if (key === "__proto__" || key === "constructor" || key === "prototype") {
    return undefined;
  }
  return value;
}

export class SaveManager<T extends object> {
  constructor(private readonly options: SaveManagerOptions) {}

  /** Serialize and persist the state with the current version and a timestamp. */
  async save(state: T): Promise<void> {
    const payload: SavePayload = {
      version: this.options.version,
      savedAt: Date.now(),
      state,
    };
    await this.options.adapter.write(this.options.key, JSON.stringify(payload));
  }

  /**
   * Load the state. Returns `null` if absent or corrupted (never throws),
   * applying the migrations needed to reach the current version.
   */
  async load(): Promise<LoadResult<T> | null> {
    let raw: string | null;
    try {
      raw = await this.options.adapter.read(this.options.key);
    } catch {
      return null;
    }
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw, safeReviver) as Partial<SavePayload>;
      let data = parsed.state;
      let version = typeof parsed.version === "number" ? parsed.version : 0;

      while (version < this.options.version) {
        const migrate = this.options.migrations?.[version + 1];
        if (migrate) {
          data = migrate(data);
        }
        version += 1;
      }

      return {
        state: data as T,
        savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : 0,
      };
    } catch {
      return null;
    }
  }

  /** Delete the save. */
  async clear(): Promise<void> {
    await this.options.adapter.remove(this.options.key);
  }
}
