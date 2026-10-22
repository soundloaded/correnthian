/**
 * The price port — Wave 1's pricing half (BE-502).
 *
 * Reference prices sit behind this interface so nothing that records one
 * learns where it came from. The user has no market-data vendor contracted;
 * the architecture must survive that changing, because an adapter written
 * against an imagined API gets rewritten against a real contract — the same
 * reasoning as `screening-provider.ts`.
 *
 * ## What a price provider owes
 *
 * A spot reference for the assets the registry holds, plus its own name as
 * the source. The source is what makes a recorded price auditable, and an
 * unattributed number is just a constant — which is why the interface
 * takes no price in and returns where every one came from.
 *
 * ## What it must not do
 *
 * Invent. An asset the provider cannot price is an asset it reports as
 * unpriced — the service records nothing and says so, rather than carrying
 * a number forward. A carried number is a fee computed from a price that
 * no longer exists, which is the single most damaging thing a metals
 * platform can do, because the gap is invisible until settlement.
 *
 * ## Delivery is scheduling, not streaming
 *
 * Prices arrive through the scheduled recording job, not a websocket: a
 * reference price updated every few minutes is fresh against a five-minute
 * staleness window, and a socket is a connection the platform must notice
 * has gone quiet. Silence on a schedule is a missed run with a name.
 */

/** One reference price, with its own name attached. */
export interface SpotPrice {
  /** The domain asset id, e.g. `1:0x…:issuer`. */
  assetId: string;
  /** US dollars per whole unit, exact. */
  priceUsd: number;
  /** Where the number came from. Recorded beside it, always. */
  source: string;
}

/** The vendor could not be reached or refused. The recording job treats
 *  this as "unknown" — it records nothing and says so — which is never
 *  mapped to a price. */
export class PriceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PriceUnavailableError';
  }
}

/** The DI token. Same shape as `SCREENING_PROVIDER` and
 *  `EMAIL_TRANSPORT`: the services take the token, not each
 *  implementation, so a new vendor is one entry in the module factory. */
export const PRICE_PROVIDER = 'correnthian:price-provider';

export abstract class PriceProvider {
  abstract readonly name: string;
  /** Spot references for every asset the provider can price. Assets it
   *  cannot price are absent, not zeroed — a zero is a price, and a price
   *  the vendor never gave is a lie. */
  abstract spotPrices(): Promise<SpotPrice[]>;
  /** Whether this provider can answer right now. The recording job asks
   *  this before iterating the registry, because a vendor that is down is
   *  a reason to record nothing, not a reason to fail the run. */
  abstract isAvailable(): Promise<boolean>;
}
