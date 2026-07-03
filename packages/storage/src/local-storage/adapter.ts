import type { SaveAdapter } from "@idlekitjs/types";

/** Web adapter backed by localStorage. */
export class LocalStorageAdapter implements SaveAdapter {
  read(key: string): string | null {
    return localStorage.getItem(key);
  }

  write(key: string, value: string): void {
    localStorage.setItem(key, value);
  }

  remove(key: string): void {
    localStorage.removeItem(key);
  }
}
