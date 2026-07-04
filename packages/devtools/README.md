# @idlekitjs/devtools

Development-only tools for IdleKit games, including a debug overlay and metrics.

## Install

This package is **private and not published to npm**. It is consumed only
through a workspace dependency (for example from the `idlekit-games`
repository, linked via a local pnpm workspace):

```json
{
  "dependencies": {
    "@idlekitjs/devtools": "workspace:^"
  }
}
```

## Import

```ts
import { devtools } from "@idlekitjs/devtools";
```

## Status

Private package. It is intentionally excluded from npm publishing: it is marked
`private`, ignored by Changesets, and guarded by a failing `prepublishOnly`
script.
