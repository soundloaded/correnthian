import type { AssetRef, SwapQuote, SwapStatus, RailKind } from '@correnthian/types';

/**
 * A SwapRail is one way to convert asset A into asset B.
 *
 * App code must never reference a concrete rail. It resolves a rail from the
 * registry by capability, which is what lets the primary rail change - from
 * DEX to a licensed metals provider - without touching a single screen.
 */
export interface SwapRail {
  readonly id: string;
  readonly kind: RailKind;

  supports(from: AssetRef, to: AssetRef): boolean;

  /**
   * Price a conversion. MUST be honest about its own limits: set
   * executionQuality and sizeCap rather than quoting a size it cannot fill.
   */
  quote(req: QuoteRequest): Promise<SwapQuote>;

  status(quoteId: string): Promise<SwapStatus>;
}

export interface QuoteRequest {
  readonly from: AssetRef;
  readonly to: AssetRef;
  /** Base units of `from`, as a decimal string. Never a JS number. */
  readonly fromAmount: string;
  /** USD notional; providers quote against it rather than token units. */
  readonly notionalUsd?: string;
  readonly slippageBps?: number;
}

export class UnsupportedRailError extends Error {
  constructor(public readonly railId: string) {
    super(`Rail "${railId}" does not support the requested pair`);
    this.name = 'UnsupportedRailError';
  }
}

/** Select the best rail for a pair. Later: prefer provider, fall back to dex. */
export function selectRail(rails: readonly SwapRail[], from: AssetRef, to: AssetRef): SwapRail | undefined {
  return rails.find((r) => r.supports(from, to));
}
