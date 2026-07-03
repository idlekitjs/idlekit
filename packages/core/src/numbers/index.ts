/**
 * Big numbers for incremental games.
 *
 * Idle games quickly exceed `Number.MAX_SAFE_INTEGER`. The in-house `Decimal`
 * (mantissa + base-10 exponent) keeps a double's precision while extending the
 * range far beyond `Number.MAX_VALUE`.
 *
 * `DecimalSource` stays here (coupled to the `Decimal` implementation) rather
 * than in `@idlekitjs/types`, so that `@idlekitjs/types` keeps no dependency on the
 * engine's runtime.
 */
export { Decimal, D } from "./decimal";
export type { DecimalSource } from "./decimal";
