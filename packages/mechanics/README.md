# @idlekitjs/mechanics

Reusable idle gameplay primitives for producers, modifiers, collections,
projects, crafting, boosts, containers, timers, and pickups.

- Documentation: <https://idlekitjs.github.io/packages/mechanics>
- Repository: <https://github.com/idlekitjs/idlekit>

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

Each mechanic is a factory returning an `Extension<T>` you install with
`engine.use(...)`. Prefer the subpath imports for lean bundles; the package
barrel (`@idlekitjs/mechanics`) re-exports all of them for convenience.

## Mechanics

- `producers`, `modifiers`, `collections`, `projects`, `crafting`, `boosts`,
  `containers`, `timers`, `pickups` — one subpath each
  (`@idlekitjs/mechanics/<mechanic>`).
- Optional Economy bridges live at `@idlekitjs/mechanics/<mechanic>/economy`
  (e.g. `producers/economy`, `crafting/economy`, `containers/economy`). They are
  subpath-only, never re-exported from the barrel, so a mechanic stays usable
  without [`@idlekitjs/economy`](https://idlekitjs.github.io/packages/economy).

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

## Container Transfers

`@idlekitjs/mechanics/containers/economy` provides one-call helpers to move a
resource bag into or out of a container without hand-building a transaction:

```ts
import {
  transferBagToContainer,
  transferContainerToBag,
} from "@idlekitjs/mechanics/containers/economy";

const bag = { get: (s) => s.stock, set: (s, next) => (s.stock = next) };

// Load finished goods into the dock, or move nothing if they do not all fit.
const result = transferBagToContainer(dock, bag, state, "dock");
if (result.ok) {
  // result.moved / result.movedVolume describe what was placed.
} else {
  // result.blocked explains the block (unknown-container, empty-request,
  // missing-source, or insufficient-space).
}
```

Both helpers compose the container mechanic's own `fillUpTo`/`drain`, so the
container stays the source of truth for capacity. `mode` defaults to
`"all-or-nothing"` (move the full request or nothing, leaving no trace);
`"partial"` moves as much as the source has and the container can hold. A missing
`request` moves the whole bag / whole container.

## Status

Public package in the IdleKit toolkit, published on npm under the `@idlekitjs` scope.
