# @idlekitjs/economy

Economic vocabulary and atomic transactions for IdleKit games: resources,
accessors, costs, rewards, requirements, transactions, and cost curves. A pure
package — it evaluates against a state it never owns.

- Documentation: <https://idlekitjs.github.io/packages/economy>
- Repository: <https://github.com/idlekitjs/idlekit>

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

## Minimal usage

```ts
const economy = createEconomy<State>({ format: formatNumber }).resource({
  id: "currency:potatoes",
  label: "Potatoes",
  accessor: stateKey("potatoes"),
});

economy.execute(state, {
  id: "buy-upgrade",
  cost: [["currency:potatoes", 100]],
  apply: (s) => {
    s.upgrades.push("plow");
  },
});
```

## Key APIs

- `createEconomy` / `EconomyError` — the economy instance and its error type.
- `defineResource`, and accessors `stateKey` / `arrayIndex` / `recordField` /
  `computed` / `readonly` (also on the `@idlekitjs/economy/accessors` subpath).
- `previewTransaction` / `executeTransaction` — atomic, all-or-nothing exchanges
  with affordability diagnostics.
- Amount helpers `normalizeAmounts` / `mergeAmounts` / `scaleAmounts` /
  `collectAmounts`, requirements `allOf` / `not` / `resourceAtLeast` /
  `resourceAtMost`, and `describeFailure` for UI.
- Cost curves `costCurve` / `flat` / `geometric` / `geometricSum` /
  `geometricAffordable` (also on `@idlekitjs/economy/cost-curves`).

## Transactions vs direct state

Use `preview` / `execute` transactions for player-visible resource exchanges:
costs, purchases, selling, crafting costs, upgrades, packs, and anything that
needs affordability diagnostics.

Direct state mutation is fine for simulation ticks, counters, diagnostics,
elapsed/progress state, one-off game-specific side effects, and non-economic
domain state. Not every state change needs to be modeled as an economic action.

## Status

Public package in the IdleKit toolkit, published on npm under the `@idlekitjs` scope.
