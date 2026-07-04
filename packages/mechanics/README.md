# @idlekitjs/mechanics

Reusable idle gameplay primitives for producers, modifiers, collections,
projects, crafting, boosts, containers, timers, and pickups.

## Install

IdleKit is ESM-only and published on npm under the `@idlekitjs` scope:

```sh
pnpm add @idlekitjs/mechanics
npm install @idlekitjs/mechanics
yarn add @idlekitjs/mechanics
```

## Import

```ts
import { producers } from "@idlekitjs/mechanics/producers";
import { economyPurchase } from "@idlekitjs/mechanics/producers/economy";
```

## Rendering Progress

Reactive bindings are for discrete state changes: counts, affordability,
visible lists, completed jobs, and other values that change when a top-level
state key is reassigned.

Use frame callbacks for continuous derived values that may be backed by
in-place mutable state: producer cycle progress bars, crafting progress bars,
timer countdowns/progress, pickup lifetime/expiry UI, and live debug rows.
With `@idlekitjs/dom`, that means `renderer.addFrame(...)`.

## Crafting Modifiers

`crafting` accepts optional `getSpeedMultiplier` and `getYieldMultiplier`
callbacks for game-side bonuses, upgrades, and temporary effects.

Speed is captured when a job starts and divides the recipe duration. The
captured active job duration is stored on the job and preserved across load when
valid, so saves and offline advancement stay deterministic.

Yield is resolved when a job completes. It applies uniformly to every entry in
`recipe.outputs`, including byproducts; per-output yield modifiers are out of
scope. Fractional outputs are kept by default, or can be rounded with
`yieldRounding: "floor"` / `"round"` / `"ceil"`. `onComplete` receives the actual credited
outputs after multiplier and rounding.

## Status

Public package in the IdleKit toolkit, published on npm under the `@idlekitjs` scope.
