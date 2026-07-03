/** A reactive state key (an object property name). */
export type StateKey = string | symbol;

/** Notified on flush with the set of keys that changed since the last flush. */
export type FlushListener = (dirtyKeys: ReadonlySet<StateKey>) => void;
