# @idlekitjs/storage

Persistence backends for the IdleKit `SaveManager`, including memory and
localStorage adapters.

- Documentation: <https://idlekitjs.github.io/packages/storage>
- Repository: <https://github.com/idlekitjs/idlekit>

## Install

IdleKit is ESM-only and published on npm under the `@idlekitjs` scope:

```sh
pnpm add @idlekitjs/storage
npm install @idlekitjs/storage
yarn add @idlekitjs/storage
```

## Import

```ts
import { MemoryAdapter } from "@idlekitjs/storage/memory";
import { LocalStorageAdapter } from "@idlekitjs/storage/local-storage";
```

## Minimal usage

An adapter implements the `SaveAdapter` contract and is passed to the core
`SaveManager`:

```ts
import { SaveManager } from "@idlekitjs/core";
import { LocalStorageAdapter } from "@idlekitjs/storage/local-storage";

const saves = new SaveManager<State>({
  key: "my-game",
  version: 1,
  adapter: new LocalStorageAdapter(),
});
```

## Key APIs

- `LocalStorageAdapter` — browser `localStorage` persistence.
- `MemoryAdapter` — in-memory persistence for tests and headless runs.

Both are also re-exported from the package barrel; prefer the subpaths for lean
bundles. Writing your own backend is just implementing `SaveAdapter` from
[`@idlekitjs/types`](https://idlekitjs.github.io/packages/types).

## Status

Public package in the IdleKit toolkit, published on npm under the `@idlekitjs` scope.
