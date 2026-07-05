# @idlekitjs/browser

Browser runtime bridges for IdleKit games: page lifecycle, requestAnimationFrame
scheduling, and screen helpers. Each brick connects one browser API to an engine
contract, keeping [`@idlekitjs/core`](https://idlekitjs.github.io/packages/core)
headless.

- Documentation: <https://idlekitjs.github.io/packages/browser>
- Repository: <https://github.com/idlekitjs/idlekit>

## Install

IdleKit is ESM-only and published on npm under the `@idlekitjs` scope:

```sh
pnpm add @idlekitjs/browser
npm install @idlekitjs/browser
yarn add @idlekitjs/browser
```

## Import

```ts
import { pageLifecycle } from "@idlekitjs/browser/page-lifecycle";
import { createRafScheduler } from "@idlekitjs/browser/raf-scheduler";
import { devicePixelRatio } from "@idlekitjs/browser/screen";
```

## Minimal usage

```ts
const engine = createEngine<State>({
  initialState,
  scheduler: createRafScheduler(), // drives the loop from requestAnimationFrame
});
engine.use(pageLifecycle()); // emits `resume` with the elapsed background time
```

## Key APIs

- `createRafScheduler` — a `FrameScheduler` backed by `requestAnimationFrame`.
- `pageLifecycle` — pauses/resumes on tab visibility and emits the `resume`
  event with elapsed background time (in **milliseconds**).
- `devicePixelRatio`, `cssToDevicePx`, `deviceToCssPx` — screen/pixel helpers.

Not rendering: the DOM renderer and bindings live in
[`@idlekitjs/dom`](https://idlekitjs.github.io/packages/dom).

## Status

Public package in the IdleKit toolkit, published on npm under the `@idlekitjs` scope.
