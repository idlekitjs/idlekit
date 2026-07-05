# @idlekitjs/utils

Framework-agnostic helpers shared across IdleKit packages and games: number
clamping/fallbacks and frame-rate measurement, with no engine, DOM or browser
dependency.

- Documentation: <https://idlekitjs.github.io/packages/utils>
- Repository: <https://github.com/idlekitjs/idlekit>

## Install

IdleKit is ESM-only and published on npm under the `@idlekitjs` scope:

```sh
pnpm add @idlekitjs/utils
npm install @idlekitjs/utils
yarn add @idlekitjs/utils
```

## Import

```ts
import { clamp, finiteOr, positiveOr, FrameRateMeter } from "@idlekitjs/utils";
```

## Key APIs

- `clamp(value, min, max)` — constrain a number to an inclusive range.
- `finiteOr(value, fallback)` — `value` when finite (not `NaN`/`Infinity`),
  otherwise `fallback`.
- `positiveOr(value, fallback)` — `value` when finite and `> 0`, otherwise
  `fallback`.
- `FrameRateMeter` — smoothed frames-per-second from `performance.now()`-style
  timestamps.

```ts
const speed = positiveOr(config.speed, 1); // reject 0 / negative / non-finite
const progress = clamp(elapsed / duration, 0, 1);
const budget = finiteOr(inputBudget, 0);
```

Browser/display helpers such as `devicePixelRatio` live in
[`@idlekitjs/browser`](https://idlekitjs.github.io/packages/browser), not here.

## Status

Public package in the IdleKit toolkit, published on npm under the `@idlekitjs` scope.
