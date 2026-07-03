export interface BindEachOptions<VM> {
  /** Current items, in desired DOM order. */
  items: () => Iterable<VM>;
  /** Stable key per item (drives element identity across renders). */
  key: (item: VM) => string;
  /** Build the element for a newly appeared key. */
  create: (item: VM) => HTMLElement;
  /** Refresh an existing element (called on every render, new elements included). */
  update?: (element: HTMLElement, item: VM) => void;
  /**
   * Called when a key disappears, before the element leaves the DOM. Return a
   * promise to delay the actual removal (exit animation); the element is no
   * longer tracked either way, so a re-appearing key gets a fresh element.
   */
  remove?: (element: HTMLElement, item: VM) => void | Promise<void>;
}
