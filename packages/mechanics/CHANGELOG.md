# @idlekitjs/mechanics

## 0.2.0

### Minor Changes

- 075d9da: Add crafting speed/yield multiplier options.

  Crafting jobs can now capture a speed multiplier at start and resolve a yield
  multiplier at completion, with optional yield rounding. Valid active job
  durations are preserved across load, and `onComplete` receives the actual
  credited outputs after multiplier and rounding.
