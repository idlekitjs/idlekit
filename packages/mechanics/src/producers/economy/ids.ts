import type { ResourceId } from "@idlekitjs/economy";

/**
 * Resource id of a producer tier's unit pool: `producer:<id>`. The single
 * place where the convention lives — transactions, requirements and displays
 * derive ids from here instead of hand-writing strings.
 */
export function producerResourceId(id: string): ResourceId {
  return `producer:${id}`;
}
