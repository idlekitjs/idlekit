import type { SaveAdapter } from "@idlekitjs/types";

/** In-memory adapter, useful for tests and server-side rendering. */
export class MemoryAdapter implements SaveAdapter {
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
