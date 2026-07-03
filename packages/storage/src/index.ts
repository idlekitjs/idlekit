/**
 * @idlekitjs/storage - persistence backends for the @idlekitjs SaveManager.
 *
 * Prefer the subpath imports, which keep bundles lean and ease a later split
 * into dedicated `@idlekitjs/storage-*` packages (e.g. native sqlite/capacitor):
 *
 *   import { LocalStorageAdapter } from "@idlekitjs/storage/local-storage";
 *   import { MemoryAdapter } from "@idlekitjs/storage/memory";
 *
 * This barrel is provided for convenience only.
 */
export { LocalStorageAdapter } from "./local-storage";
export { MemoryAdapter } from "./memory";
