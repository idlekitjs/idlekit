import { EconomyError } from "../economy/errors";
import type { ResourceAccessor } from "../resources/types";

/** Accessor produced by {@link readonly}: observable, never writable. */
export interface ReadonlyResourceAccessor<T> extends ResourceAccessor<T> {
  readonly readonly: true;
}

/**
 * Accessor for an observable value that must never be credited or spent
 * directly (a card level, a rank, a derived stat). `get` works normally;
 * `add` throws. Resources defined with it get `readonly: true`, so
 * transactions reject them in cost/reward *before* ever calling `add` —
 * the throw here is only the last-resort guard for direct misuse.
 */
function readonlyAccessor<T>(get: (state: T) => number): ReadonlyResourceAccessor<T> {
  return {
    readonly: true,
    get,
    add: () => {
      throw new EconomyError("Cannot add to a read-only resource accessor.");
    },
  };
}

export { readonlyAccessor as readonly };
