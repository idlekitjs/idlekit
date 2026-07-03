/**
 * Persistence abstraction.
 *
 * Lets you plug `localStorage` on the web and `@capacitor/preferences` on mobile
 * without changing game logic. Methods may be sync or async (the SaveManager
 * always awaits the result).
 */
export interface SaveAdapter {
  read(key: string): string | null | Promise<string | null>;
  write(key: string, value: string): void | Promise<void>;
  remove(key: string): void | Promise<void>;
}

/** Transforms a save from one version to the next. */
export type Migration = (data: unknown) => unknown;

/** Result of a successful load. */
export interface LoadResult<T> {
  state: T;
  savedAt: number;
}
