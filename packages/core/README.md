# @idlekitjs/core

Headless IdleKit engine runtime: reactive state, simulation loop, events, save
manager, decimal numbers, randomness, and formatting helpers.

## Install

```sh
pnpm add @idlekitjs/core
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

## Status

Public package in the IdleKit toolkit, published on npm under the `@idlekitjs` scope.
