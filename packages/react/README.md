# @idlekitjs/react

React bindings for IdleKit engines. This package is the React sibling of
`@idlekitjs/dom`: a thin bridge from React components to the core engine's
state and events. It provides a context provider and hooks — nothing else. The
engine itself comes from `@idlekitjs/core`, and its lifecycle (create, start,
dispose) stays in your app code.

- Documentation: <https://idlekitjs.github.io/packages/react>
- Repository: <https://github.com/idlekitjs/idlekit>

## Add to your project

IdleKit is ESM-only and published on npm under the `@idlekitjs` scope:

```sh
pnpm add @idlekitjs/react
npm install @idlekitjs/react
yarn add @idlekitjs/react
```

`react` (18 or newer) is a peer dependency: your app provides it.

## Usage

```tsx
import { createEngine } from "@idlekitjs/core";
import { IdleKitProvider, useIdleKitSelector, useIdleKitEngine } from "@idlekitjs/react";

interface GameState {
  coins: number;
}

// App-owned engine: create it once, outside React.
const engine = createEngine<GameState>({ initialState: { coins: 0 } });
engine.addSystem((state, dt) => {
  state.coins += dt;
});
engine.start();

function Coins() {
  const coins = useIdleKitSelector((state: GameState) => state.coins);
  return <div>{coins}</div>;
}

function CheatButton() {
  const engine = useIdleKitEngine<GameState>();
  return <button onClick={() => (engine.state.coins += 100)}>+100</button>;
}

export function App() {
  return (
    <IdleKitProvider engine={engine}>
      <Coins />
      <CheatButton />
    </IdleKitProvider>
  );
}
```

## API

- `IdleKitProvider` — provides an app-created `Engine` to the component tree.
- `useIdleKitEngine()` — returns the engine from context (throws outside the
  provider).
- `useIdleKitSelector(selector, isEqual?)` — subscribes to a selected slice of
  the engine state; re-renders only when the selected value changes
  (`Object.is` by default).
- `useIdleKitEvent(type, handler)` — subscribes a handler to an engine event
  for the component's lifetime.

Nothing from `@idlekitjs/core` is re-exported: import `createEngine` and other
engine APIs from `@idlekitjs/core` directly.

## Reactivity caveat: top-level keys

The core store tracks **top-level state keys only** (the same limitation as
the `@idlekitjs/dom` bindings). A deep mutation such as
`state.resources.coins++` does not mark `resources` dirty, so selectors will
not update. Reassign the top-level key instead:

```ts
state.resources = { ...state.resources, coins: state.resources.coins + 1 };
```

Selectors re-run after each store flush (once per frame while the engine
runs). Selectors that return fresh objects or arrays should pass a structural
`isEqual` to avoid re-rendering on every flush.

## Non-goals

This package contains React reactivity glue only. It does not and will not
provide:

- economy, mechanics, or game-domain hooks (`useCoins`, `useResource`,
  `useProducer`, `useCrafting`, `useBoost`, ...) — compose
  `@idlekitjs/economy` / `@idlekitjs/mechanics` in your game code and render
  their state with `useIdleKitSelector`;
- persistence hooks (`useSave`, `useLoad`, `useAutosave`,
  `useOfflineProgress`) — saving lives in `@idlekitjs/core`'s `SaveManager`,
  `@idlekitjs/storage` adapters, and `@idlekitjs/plugins` policies, wired at
  engine setup;
- browser runtime concerns (schedulers, page lifecycle) — see
  `@idlekitjs/browser`.

## Status

Public package in the IdleKit toolkit, published on npm under the `@idlekitjs`
scope.
