---
"@idlekitjs/mechanics": minor
---

Add `transferBagToContainer` and `transferContainerToBag` to
`@idlekitjs/mechanics/containers/economy`. These one-call helpers move a resource
bag into or out of a container by composing the mechanic's existing
`fillUpTo`/`drain` primitives, so the container stays the source of truth for
capacity. Both support `"all-or-nothing"` (default) and `"partial"` modes and
return `{ ok, moved, movedVolume, blocked? }`, where `blocked` diagnoses an
unknown container, an empty request, a source shortfall, or insufficient space.
Additive and backward compatible: no existing exports or behavior change.
