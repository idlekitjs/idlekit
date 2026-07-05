# @idlekitjs/mechanics

## 0.3.1

### Patch Changes

- Updated dependencies [3b4f2f8]
  - @idlekitjs/core@0.3.0

## 0.3.0

### Minor Changes

- ed8082d: Add `transferBagToContainer` and `transferContainerToBag` to
  `@idlekitjs/mechanics/containers/economy`. These one-call helpers move a resource
  bag into or out of a container by composing the mechanic's existing
  `fillUpTo`/`drain` primitives, so the container stays the source of truth for
  capacity. Both support `"all-or-nothing"` (default) and `"partial"` modes and
  return `{ ok, moved, movedVolume, blocked? }`, where `blocked` diagnoses an
  unknown container, an empty request, a source shortfall, or insufficient space.
  Additive and backward compatible: no existing exports or behavior change.

### Patch Changes

- Updated dependencies [66609a1]
  - @idlekitjs/core@0.2.0

## 0.2.0

### Minor Changes

- 075d9da: Add crafting speed/yield multiplier options.

  Crafting jobs can now capture a speed multiplier at start and resolve a yield
  multiplier at completion, with optional yield rounding. Valid active job
  durations are preserved across load, and `onComplete` receives the actual
  credited outputs after multiplier and rounding.
