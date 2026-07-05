---
"@idlekitjs/core": minor
---

Add `formatDurationSeconds(seconds)` to `@idlekitjs/core`, the seconds-domain
companion to `formatDuration(ms)`. Simulation/mechanics durations are all in
seconds, so this avoids the manual `* 1000` at call sites. It is a thin wrapper
over `formatDuration` (same `d/h/m/s` output and sub-second flooring);
`formatDuration` is unchanged. Additive and backward compatible.
