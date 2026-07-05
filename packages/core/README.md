# @idlekitjs/core

Headless IdleKit engine runtime: reactive state, simulation loop, events, save
manager, decimal numbers, randomness, and formatting helpers.

## Install

IdleKit is ESM-only and published on npm under the `@idlekitjs` scope:

```sh
pnpm add @idlekitjs/core
npm install @idlekitjs/core
yarn add @idlekitjs/core
```

## Import

```ts
import { createEngine, manualScheduler, SaveManager } from "@idlekitjs/core";

const scheduler = manualScheduler();
const engine = createEngine({
  initialState: { coins: 0 },
  scheduler,
});
```

## Formatting

```ts
import { formatNumber, formatInteger, parseNumber, SUFFIXES } from "@idlekitjs/core";

formatNumber(2_500_000); // "2.50M"  — compact tier suffix (K, M, B, T, Qa, Qi, ...)
formatInteger(1234567); // "1,234,567" — thousands separators
parseNumber("15Qi"); // 1.5e19 — inverse of formatNumber, for authoring big values
SUFFIXES; // readonly ["", "K", "M", ...] shared by both directions
```

- `parseNumber(value: string): number` is the inverse of `formatNumber`: it
  parses plain numbers (`"123"`), decimals (`"1.5"`), scientific notation
  (`"1.5e19"`) and compact suffix notation (`"1K"`, `"2.5M"`, `"15Qi"`). It is
  handy for authoring large recipe/resource values — `parseNumber("15Qi")`
  reads better than `15_000_000_000_000_000_000`. It returns a plain JavaScript
  `number` (not a `Decimal`) and reuses the same `SUFFIXES` table as
  `formatNumber`, so the two stay in sync. Suffixes are case-sensitive; invalid
  input throws.

### Duration units

- Simulation/mechanics durations are in **seconds** (`dt`, `step`, and
  producer/timer/crafting/boost durations).
- Wall-clock and browser/plugin options with an `Ms` suffix are in
  **milliseconds** (`offlineProgress.maxMs`, `autosave.intervalMs`,
  `devtools.refreshMs`, the `resume` event).
- `formatDuration` currently takes **milliseconds**. Convert seconds-domain
  values explicitly (`formatDuration(seconds * 1000)`) until a seconds-domain
  formatter is designed.

## Status

Public package in the IdleKit toolkit, published on npm under the `@idlekitjs` scope.
