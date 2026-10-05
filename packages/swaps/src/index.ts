import type { AssetRef, SwapQuote, SwapStatus, RailKind } from '@correnthian/types';

/**
 * A SwapRail is one way to convert asset A into asset B.
 *
 * App code must never reference a concrete rail. It resolves a rail from the
 * registry by capability, which is what lets the primary rail change — from
 * DEX to a licensed metals provider — without touching a single screen.
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

/**
 * Preference order, highest first.
 *
 * This is the single most important execution decision in v1 and it is
 * encoded here rather than left to the order rails happen to be registered
 * in. The beachhead user pays by card and never holds USDT, so a licensed
 * provider is the only rail that can actually serve them; DEX is a fallback
 * for users who already hold crypto. Getting this wrong silently sends the
 * majority of users down a rail they cannot use.
 */
export const RAIL_PREFERENCE: readonly RailKind[] = ['provider', 'dex', 'cex', 'otc'];

const rank = (kind: RailKind): number => {
  const i = RAIL_PREFERENCE.indexOf(kind);
  return i === -1 ? RAIL_PREFERENCE.length : i;
};

/** Select the highest-preference rail that supports the pair. */
export function selectRail(
  rails: readonly SwapRail[],
  from: AssetRef,
  to: AssetRef,
): SwapRail | undefined {
  return rails
    .filter((rail) => rail.supports(from, to))
    .sort((a, b) => rank(a.kind) - rank(b.kind))[0];
}
