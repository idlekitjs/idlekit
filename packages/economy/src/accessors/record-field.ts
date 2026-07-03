import type { ResourceAccessor } from "../resources/types";
import type { NumberFields } from "./types";

export interface RecordFieldOptions<T, E extends object, K extends NumberFields<E>> {
  getRecord(state: T): Record<string, E>;
  /** Reassign the given record into the state (keeps reactivity). */
  setRecord(state: T, record: Record<string, E>): void;
  /** Record key of the targeted entry. */
  key: string;
  /** Number field inside the entry. */
  field: K;
  /** Fresh entry used when `key` is absent (created on the first write). */
  defaultEntry(): E;
}

/**
 * Accessor for a number field inside one entry of a record, e.g.
 * `state.cards["collective-manager"].shards`. Reads fall back to the default
 * entry's value when the key is absent; writes create the entry on demand,
 * clone both the record and the entry, and reassign through `setRecord`.
 */
export function recordField<T, E extends object, K extends NumberFields<E> = NumberFields<E>>(
  options: RecordFieldOptions<T, E, K>,
): ResourceAccessor<T> {
  const { getRecord, setRecord, key, field, defaultEntry } = options;
  return {
    get: (state) => {
      const entry = getRecord(state)[key] ?? defaultEntry();
      return entry[field] as unknown as number;
    },
    add: (state, amount) => {
      const record = getRecord(state);
      const entry = { ...(record[key] ?? defaultEntry()) };
      (entry as Record<K, number>)[field] = (entry[field] as unknown as number) + amount;
      setRecord(state, { ...record, [key]: entry });
    },
  };
}
