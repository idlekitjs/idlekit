/**
 * Type-level key filters used by the official accessors, so a typo or a
 * non-numeric field is a compile error rather than a runtime surprise.
 */

/** Keys of `T` whose (required) value is a number. */
export type NumberKeys<T> = {
  [K in keyof T]-?: T[K] extends number ? K : never;
}[keyof T];

/** Keys of `E` whose (required) value is a number. */
export type NumberFields<E> = {
  [K in keyof E]-?: E[K] extends number ? K : never;
}[keyof E];
