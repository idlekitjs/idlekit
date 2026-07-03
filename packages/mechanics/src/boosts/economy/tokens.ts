import type { ResourceId, Transaction } from "@idlekitjs/economy";
import type { BoostsExtension } from "../types";

/** Resource id of a boost's activation tokens: `boost-token:<id>`. */
export function boostTokenResourceId(id: string): ResourceId {
  return `boost-token:${id}`;
}

export interface ActivateBoostOptions {
  boostId: string;
  /** Token resource consumed (default: `boostTokenResourceId(boostId)`). */
  tokenId?: ResourceId;
  /** Tokens consumed per activation (default: 1). */
  tokens?: number;
  id?: string;
  label?: string;
}

/**
 * Transaction that spends a token and grants the boost. The token itself is
 * an ordinary resource the game declares (stateKey/recordField over its own
 * state); boosts never depend on Economy — `grant` simply runs in `apply`.
 */
export function activateBoost<T extends object>(
  boosts: BoostsExtension<T>,
  options: ActivateBoostOptions,
): Transaction<T> {
  const tokenId = options.tokenId ?? boostTokenResourceId(options.boostId);
  return {
    id: options.id ?? `activate-boost:${options.boostId}`,
    label: options.label,
    cost: [[tokenId, options.tokens ?? 1]],
    apply: (state) => {
      boosts.grant(state, options.boostId);
    },
  };
}
