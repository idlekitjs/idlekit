import type { ResourceAccessor } from "../resources/types";
import type { NumberKeys } from "./types";

/**
 * Accessor for a top-level number field of the state:
 * `stateKey<State>("potatoes")`. The field is mutated in place (assignment),
 * which reactive store proxies observe directly.
 *
 * Only keys holding a `number` are accepted; anything else is a type error.
 */
export function stateKey<T, K extends NumberKeys<T> = NumberKeys<T>>(
  key: K,
): ResourceAccessor<T> {
  return {
    get: (state) => state[key] as unknown as number,
    add: (state, amount) => {
      (state as Record<K, number>)[key] = (state[key] as unknown as number) + amount;
    },
  };
}
