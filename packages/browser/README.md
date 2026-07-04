# @idlekitjs/browser

Browser runtime bridges for IdleKit games: page lifecycle, requestAnimationFrame
scheduling, and screen helpers.

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

## Status

Public package in the IdleKit toolkit, published on npm under the `@idlekitjs` scope.
