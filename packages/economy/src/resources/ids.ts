import { EconomyError } from "../economy/errors";
import type { ResourceId } from "./types";

/**
 * Wiring-time id validation: non-empty, no whitespace, no leading/trailing
 * `:`. The `namespace:name` convention is documented but deliberately not
 * enforced — games stay free of their own naming schemes.
 */
export function validateResourceId(id: ResourceId): void {
  if (typeof id !== "string" || id.length === 0) {
    throw new EconomyError("Resource id must be a non-empty string.");
  }
  if (/\s/.test(id)) {
    throw new EconomyError(`Resource id "${id}" must not contain whitespace.`);
  }
  if (id.startsWith(":") || id.endsWith(":")) {
    throw new EconomyError(`Resource id "${id}" must not start or end with ":".`);
  }
}
