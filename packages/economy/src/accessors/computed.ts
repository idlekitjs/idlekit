import type { ResourceAccessor } from "../resources/types";

/**
 * Explicit escape hatch: any custom `get`/`add` pair is a valid accessor.
 * `computed` only exists so that hand-rolled accessors have a name and a
 * documentation anchor — it adds no behavior.
 */
export function computed<T>(accessor: ResourceAccessor<T>): ResourceAccessor<T> {
  return accessor;
}
