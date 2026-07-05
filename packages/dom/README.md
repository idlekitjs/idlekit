# @idlekitjs/dom

DOM renderer and declarative bindings for IdleKit games. Optional, and owns DOM
concerns only — the dependency flows `dom -> core`, never the reverse.

- Documentation: <https://idlekitjs.github.io/packages/dom>
- Repository: <https://github.com/idlekitjs/idlekit>

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

## Key APIs

- `Renderer` — the dependency-tracked binding runner; inject it via
  `createEngine({ renderer })`.
- `bindText`, `bindClass`, `bindVisible`, `bindDisabled` — built-in element
  bindings that cache and skip identical DOM writes.
- `bindEach` — keyed list rendering (also on `@idlekitjs/dom/bind-each`).

Building a React UI instead? Use
[`@idlekitjs/react`](https://idlekitjs.github.io/packages/react). Browser
runtime bridges (rAF scheduler, page lifecycle, screen helpers) live in
[`@idlekitjs/browser`](https://idlekitjs.github.io/packages/browser).

## Reactive vs frame bindings

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
