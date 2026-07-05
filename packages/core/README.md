# @idlekitjs/core

Headless IdleKit engine runtime: reactive state, simulation loop, events, save
manager, decimal numbers, randomness, and formatting helpers.

- Documentation: <https://idlekitjs.github.io/packages/core>
- Repository: <https://github.com/idlekitjs/idlekit>

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

```ts
import { formatDuration, formatDurationSeconds } from "@idlekitjs/core";

formatDurationSeconds(90); // "1m 30s" — seconds (simulation/mechanics domain)
formatDuration(90_000); //    "1m 30s" — milliseconds (wall-clock domain)
```

- Simulation/mechanics durations are in **seconds** (`dt`, `step`, and
  producer/timer/crafting/boost durations). Format them with
  `formatDurationSeconds(seconds)`.
- Wall-clock and browser/plugin options with an `Ms` suffix are in
  **milliseconds** (`offlineProgress.maxMs`, `autosave.intervalMs`,
  `devtools.refreshMs`, the `resume` event). Format them with
  `formatDuration(ms)`.
- `formatDurationSeconds` is a thin wrapper over `formatDuration`, so both share
  the same `d/h/m/s` output and sub-second flooring.

## Key APIs

- `createEngine` / `Engine` — the runtime orchestrator (systems, extensions,
  fixed-step loop, `advance` for offline catch-up).
- `SimulationLoop`, `manualScheduler` — the fixed-step loop and headless/test
  frame driver.
- `ReactiveStore` — proxy-based state; tracks **top-level keys only**.
- `EventBus` — typed engine events (`loaded`, `resume`).
- `SaveManager` — versioned save/load with migrations (adapters come from
  [`@idlekitjs/storage`](https://idlekitjs.github.io/packages/storage)).
- `Decimal` / `D`, `Random` / `createRandom` — big numbers and a seedable PRNG.
- `formatNumber`, `formatInteger`, `parseNumber`, `SUFFIXES`, `formatDuration`,
  `formatDurationSeconds` — formatting helpers (above).

Core is headless: rendering lives in
[`@idlekitjs/dom`](https://idlekitjs.github.io/packages/dom) /
[`@idlekitjs/react`](https://idlekitjs.github.io/packages/react), and browser
frame/lifecycle bridges in
[`@idlekitjs/browser`](https://idlekitjs.github.io/packages/browser).

## Status

Public package in the IdleKit toolkit, published on npm under the `@idlekitjs` scope.
