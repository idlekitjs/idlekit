# IdleKit

IdleKit is a TypeScript toolkit for incremental and idle games. It provides a
headless engine, economic primitives, reusable mechanics, browser and DOM
bridges, save adapters, and operational plugins that can be composed by private
games.

This repository contains only the `@idlekitjs/*` npm packages. The
documentation site lives in the `idlekit-docs` repository and the private games
live in the `idlekit-games` repository.

## Installation

Use pnpm for development:

```sh
pnpm install
```

Install public packages in a consumer project as needed:

```sh
pnpm add @idlekitjs/core @idlekitjs/browser @idlekitjs/dom @idlekitjs/storage
```

## Packages

Public publish-ready packages:

- `@idlekitjs/types`: shared engine contracts.
- `@idlekitjs/utils`: framework-agnostic helpers.
- `@idlekitjs/core`: headless engine, state, loop, events, saves, numbers, random, and formatting.
- `@idlekitjs/economy`: resources, accessors, costs, rewards, requirements, transactions, and cost curves.
- `@idlekitjs/storage`: memory and localStorage save adapters.
- `@idlekitjs/dom`: DOM renderer and bindings.
- `@idlekitjs/browser`: page lifecycle, requestAnimationFrame scheduler, and screen helpers.
- `@idlekitjs/mechanics`: reusable idle gameplay mechanics.
- `@idlekitjs/plugins`: autosave and offline progress policies.

Private package:

- `@idlekitjs/devtools`: local development tools. It is currently private and unpublished.

## Minimal Example

```ts
import { createEngine } from "@idlekitjs/core";
import { createRafScheduler } from "@idlekitjs/browser/raf-scheduler";

type State = {
  coins: number;
};

const engine = createEngine<State>({
  initialState: { coins: 0 },
  scheduler: createRafScheduler(),
});

engine.addSystem((state, dt) => {
  state.coins += dt;
});

engine.start();
```

## Development

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm lint
```

The workspace contains only `packages/*`; building, testing, and publishing the
packages does not require the docs or games repositories.

## Build

Build all local packages, including the private devtools package:

```sh
pnpm build
```

Build only the public publishable packages:

```sh
pnpm build:public
```

Each package builds ESM output and declaration files into `dist/` with tsup.
TypeScript remains responsible for typechecking.

## Test

```sh
pnpm test
pnpm test:watch
```

## Publishing Workflow

Changesets is configured, but this workspace is not publishing packages yet.

1. Make package changes.
2. Run `pnpm changeset` for user-visible package changes.
3. Run `pnpm version-packages` when preparing a release.
4. Run `pnpm build:public`.
5. Run package dry-runs before publishing.
6. Run `pnpm release` only from the future public package repository when npm publishing is intended.

Confirm the `repository`, `homepage`, and `bugs` URLs before the first real npm
publish if the final GitHub organization or repository name differs.
