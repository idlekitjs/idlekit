import { EconomyError } from "../economy/errors";
import { validateResourceId } from "./ids";
import type { ResourceAccessor, ResourceDef, ResourceInit } from "./types";

/**
 * Normalize a {@link ResourceInit} (either `accessor` or inline `get`/`add`)
 * into a {@link ResourceDef} with every default resolved. Throws
 * {@link EconomyError} at wiring time on invalid ids or bounds — a broken
 * definition must explode at boot, not mid-game.
 */
export function defineResource<T>(init: ResourceInit<T>): ResourceDef<T> {
  validateResourceId(init.id);

  // The union guarantees get/add are present when `accessor` is absent; the
  // runtime guard below covers untyped callers.
  const accessor = init.accessor ?? ({ get: init.get, add: init.add } as ResourceAccessor<T>);
  if (typeof accessor.get !== "function" || typeof accessor.add !== "function") {
    throw new EconomyError(
      `Resource "${init.id}" needs an accessor or an inline get/add pair.`,
    );
  }

  const min = init.min ?? 0;
  const max = init.max ?? Infinity;
  if (Number.isNaN(min) || Number.isNaN(max) || min > max) {
    throw new EconomyError(`Resource "${init.id}" has invalid bounds [${min}, ${max}].`);
  }

  return {
    id: init.id,
    label: init.label ?? init.id,
    description: init.description,
    accessor,
    format: init.format,
    integer: init.integer ?? false,
    min,
    max,
    // The readonly accessor carries a marker so definitions inherit it without
    // an extra init field (see accessors/readonly).
    readonly: (accessor as { readonly?: boolean }).readonly === true,
    tags: init.tags ?? [],
    metadata: init.metadata,
  };
}
