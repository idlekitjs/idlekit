# @idlekitjs/core

## 0.2.0

### Minor Changes

- 66609a1: Add `parseNumber` to `@idlekitjs/core` and export the `SUFFIXES` tier table.
  `parseNumber(value)` is the inverse of `formatNumber`: it parses plain numbers,
  decimals, scientific notation and compact suffix notation (`"15Qi"` ->
  `1.5e19`), reusing the same shared `SUFFIXES` list so both directions stay in
  sync. Useful for authoring large recipe/resource values as readable strings; it
  returns a plain `number` (not a `Decimal`) and throws on invalid input.

  Also documents IdleKit's duration-unit conventions (simulation/mechanics
  durations in seconds; `Ms`-suffixed wall-clock/plugin options in milliseconds;
  `formatDuration` takes milliseconds). Additive and backward compatible: no
  existing exports or behavior change.
