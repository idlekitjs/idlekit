# @idlekitjs/dom

DOM renderer and declarative bindings for IdleKit games.

## Install

IdleKit is ESM-only and published on npm under the `@idlekitjs` scope:

```sh
pnpm add @idlekitjs/dom
npm install @idlekitjs/dom
yarn add @idlekitjs/dom
```

## Import

```ts
import { Renderer, bindText } from "@idlekitjs/dom";
import { bindEach } from "@idlekitjs/dom/bind-each";
```

## Reactive vs Frame Bindings

Use `renderer.add(...)` for discrete state changes, such as counts,
availability labels, visible lists, and completed jobs.

Use `renderer.addFrame(...)` for smooth continuous UI, such as progress bars,
timer countdowns, pickup lifetimes, and live debug readouts. These values may be
derived from state that mechanics mutate in place, so a reactive binding will
not necessarily run every animation frame.

```ts
renderer.add(bindText(countEl, () => String(state.items.length)));
renderer.addFrame({ update: () => progressBar.set(timer.progressFraction(state, "ship")) });
```

## Status

Public package in the IdleKit toolkit, published on npm under the `@idlekitjs` scope.
