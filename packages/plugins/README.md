# @idlekitjs/plugins

Platform-agnostic engine policies for IdleKit, including autosave and offline
progress. These are operational policies installed with `engine.use(...)`, not
gameplay primitives.

- Documentation: <https://idlekitjs.github.io/packages/plugins>
- Repository: <https://github.com/idlekitjs/idlekit>

## Install

IdleKit is ESM-only and published on npm under the `@idlekitjs` scope:

```sh
pnpm add @idlekitjs/plugins
npm install @idlekitjs/plugins
yarn add @idlekitjs/plugins
```

## Import

```ts
import { autosave } from "@idlekitjs/plugins/autosave";
import { offlineProgress } from "@idlekitjs/plugins/offline-progress";
```

## Minimal usage

```ts
engine.use(
  autosave({ manager: saves, getState: () => engine.state, intervalMs: 30_000 }),
);
engine.use(offlineProgress({ maxMs: 8 * 60 * 60 * 1000 }));
```

## Key APIs

- `autosave` / `SaveScheduler` — periodic and lifecycle-triggered saving.
- `offlineProgress` — replays elapsed wall-clock time on load via
  `engine.advance`.

Wall-clock options carry an `Ms` suffix and are in **milliseconds**
(`intervalMs`, `maxMs`), while simulation durations elsewhere are in seconds —
see the [unit conventions](https://idlekitjs.github.io/architecture/conventions#durations).
`autosave`'s default triggers touch browser APIs (`setInterval`,
`visibilitychange`, `pagehide`); provide your own triggers for non-browser
hosts.

## Status

Public package in the IdleKit toolkit, published on npm under the `@idlekitjs` scope.
