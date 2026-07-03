/**
 * A binding refreshed by the `Renderer`.
 *
 * Each binding remembers the last value it rendered and only touches its target
 * when that value changes, so refreshing every frame stays cheap.
 */
export interface Binding {
  update(): void;
}
