# @idlekitjs/economy

Economic vocabulary and atomic transactions for IdleKit games: resources,
accessors, costs, rewards, requirements, transactions, and cost curves.

## Install

IdleKit is ESM-only and published on npm under the `@idlekitjs` scope:

```sh
pnpm add @idlekitjs/economy
npm install @idlekitjs/economy
yarn add @idlekitjs/economy
```

## Import

```ts
import { createEconomy, stateKey } from "@idlekitjs/economy";
import { geometric } from "@idlekitjs/economy/cost-curves";
```

## Transactions vs Direct State

Use `preview` / `execute` transactions for player-visible resource exchanges:
costs, purchases, selling, crafting costs, upgrades, packs, and anything that
needs affordability diagnostics.

Direct state mutation is fine for simulation ticks, counters, diagnostics,
elapsed/progress state, one-off game-specific side effects, and non-economic
domain state. Not every state change needs to be modeled as an economic action.

## Status

Public package in the IdleKit toolkit, published on npm under the `@idlekitjs` scope.
