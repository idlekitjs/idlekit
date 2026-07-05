# @idlekitjs/types

Shared TypeScript contracts for IdleKit packages. This package contains engine
interfaces and save contracts with **no runtime implementation** — every export
is a `type` or `interface`.

- Documentation: <https://idlekitjs.github.io/packages/types>
- Repository: <https://github.com/idlekitjs/idlekit>

## Install

IdleKit is ESM-only and published on npm under the `@idlekitjs` scope:

```sh
pnpm add @idlekitjs/types
npm install @idlekitjs/types
yarn add @idlekitjs/types
```

## Import

```ts
import type { Extension, SaveAdapter, System } from "@idlekitjs/types";
```

## Key APIs

- `System`, `Extension`, `EngineContext` — the engine lifecycle contracts.
- `EngineEvents`, `EventEmitter`, `EventHandler` — the typed event contracts.
- `SaveAdapter`, `Migration`, `LoadResult` — the persistence contracts.
- `Binding`, `StateKey`, `FlushListener` — rendering and reactive-store
  contracts.

Most game code imports these from
[`@idlekitjs/core`](https://idlekitjs.github.io/packages/core), which re-exports
the engine-level contracts. Import from `@idlekitjs/types` directly when writing
a package, renderer or adapter that should depend on a contract without
depending on the engine implementation.

## Status

Public package in the IdleKit toolkit, published on npm under the `@idlekitjs` scope.
