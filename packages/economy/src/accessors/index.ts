/**
 * Official accessors: the shared ways of reading/writing a resource in the
 * game state without duplicating `get`/`add` pairs. Scalars are mutated in
 * place; arrays and records are cloned then reassigned, so reactive stores
 * observe every change.
 *
 * Deliberately not provided: nested string paths ("a.b.c") and auto-scanning —
 * every resource points at its state location explicitly.
 */
export { stateKey } from "./state-key";
export { arrayIndex } from "./array-index";
export type { ArrayIndexOptions } from "./array-index";
export { recordField } from "./record-field";
export type { RecordFieldOptions } from "./record-field";
export { computed } from "./computed";
export { readonly } from "./readonly";
export type { ReadonlyResourceAccessor } from "./readonly";
export type { NumberFields, NumberKeys } from "./types";
