import type { ResourceAccessor } from "../resources/types";

export interface ArrayIndexOptions<T> {
  getArray(state: T): readonly number[];
  /** Reassign the given array into the state (keeps reactivity). */
  setArray(state: T, array: number[]): void;
  index: number;
}

/**
 * Accessor for one slot of a number array (e.g. producer totals indexed by
 * tier). Reads default missing slots to `0`; writes clone the array and
 * reassign it through `setArray`, matching the clone-and-reassign reactivity
 * convention used by the mechanics.
 */
export function arrayIndex<T>(options: ArrayIndexOptions<T>): ResourceAccessor<T> {
  const { getArray, setArray, index } = options;
  return {
    get: (state) => getArray(state)[index] ?? 0,
    add: (state, amount) => {
      const array = getArray(state).slice();
      array[index] = (array[index] ?? 0) + amount;
      setArray(state, array);
    },
  };
}
