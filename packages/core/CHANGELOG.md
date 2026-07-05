# @idlekitjs/core

## 0.3.1

### Patch Changes

- 5140cd7: Docs: refresh package READMEs to match the current API and the documentation
  site, and point each `homepage` at `https://idlekitjs.github.io/packages/<name>`.

  No runtime or API changes. Highlights: `@idlekitjs/utils` now documents
  `finiteOr`; `@idlekitjs/core` covers `parseNumber` / `SUFFIXES` /
  `formatDurationSeconds` and the seconds-vs-`*Ms` duration convention;
  `@idlekitjs/mechanics` documents the crafting speed/yield modifiers,
  `yieldRounding`, and the container transfer helpers. Every README gains
  Documentation and Repository links.

- Updated dependencies [5140cd7]
  - @idlekitjs/types@0.1.1

## 0.3.0

### Minor Changes

- 3b4f2f8: Add `formatDurationSeconds(seconds)` to `@idlekitjs/core`, the seconds-domain
  companion to `formatDuration(ms)`. Simulation/mechanics durations are all in
  seconds, so this avoids the manual `* 1000` at call sites. It is a thin wrapper
  over `formatDuration` (same `d/h/m/s` output and sub-second flooring);
  `formatDuration` is unchanged. Additive and backward compatible.

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
