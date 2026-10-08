/**
 * RPC endpoint pool.
 *
 * Chains are public and their RPC providers fail independently. A single
 * endpoint makes the product's availability equal to one vendor's, so requests
 * rotate across a pool and a failing endpoint is quarantined briefly rather
 * than retried on every call.
 *
 * Failover is deliberately per-request, not sticky: a read that fails on one
 * endpoint is retried on the next immediately. Balances are public data, so
 * there is no consistency concern beyond accepting a slightly newer block.
 */

export interface RpcEndpoint {
  readonly url: string;
  /** Lower is preferred. */
  readonly weight?: number;
}

export interface RpcFailure {
  readonly url: string;
  readonly error: string;
  readonly at: number;
}

/** How long a failing endpoint is avoided before being retried. */
const QUARANTINE_MS = 30_000;

/**
 * Every endpoint that answered said the thing is not there.
 *
 * This is a **reply**, not a failure, and the distinction is the whole point.
 * `withFailover` treats it as neither: it does not quarantine the endpoint —
 * a node that correctly reports an absence is healthy — and it does not
 * surface it as `All N RPC endpoint(s) failed`, because that message means the
 * opposite. Instead it moves to the next endpoint, so a single stale or
 * forked node cannot on its own declare a transaction gone.
 *
 * Only when every endpoint has answered does it propagate, and the caller
 * decides what absence means for its own question.
 */
export class RpcAbsent extends Error {
  constructor(what = 'the resource') {
    super(`No endpoint has ${what}`);
    this.name = 'RpcAbsent';
  }
}

export class RpcPool {
  private readonly endpoints: RpcEndpoint[];
  private readonly quarantined = new Map<string, number>();
  private failures: RpcFailure[] = [];

  constructor(endpoints: readonly RpcEndpoint[]) {
    if (endpoints.length === 0) {
      throw new Error('RpcPool requires at least one endpoint');
    }
    this.endpoints = [...endpoints].sort((a, b) => (a.weight ?? 0) - (b.weight ?? 0));
  }

  get size(): number {
    return this.endpoints.length;
  }

  get recentFailures(): readonly RpcFailure[] {
    return this.failures;
  }

  /** Endpoints currently worth trying, in preference order. */
  private available(): RpcEndpoint[] {
    const now = Date.now();
    const live = this.endpoints.filter((e) => (this.quarantined.get(e.url) ?? 0) <= now);
    // If everything is quarantined, try them all rather than fail outright —
    // a blip should not take the chain offline.
    return live.length ? live : [...this.endpoints];
  }

  /**
   * Run `fn` against each endpoint in turn until one succeeds.
   *
   * Every failure is recorded. If all endpoints fail the last error is thrown,
   * with the count attached so the caller can distinguish "the chain is down"
   * from "our configuration is wrong".
   */
  async withFailover<T>(fn: (url: string) => Promise<T>): Promise<T> {
    const candidates = this.available();
    let lastError: unknown;
    /** Kept so the propagated answer still says what was not there. */
    let absent: RpcAbsent | null = null;

    for (const endpoint of candidates) {
      try {
        const result = await fn(endpoint.url);
        // A success clears the endpoint's record entirely.
        this.quarantined.delete(endpoint.url);
        this.failures = this.failures.filter((f) => f.url !== endpoint.url);
        return result;
      } catch (err) {
        if (err instanceof RpcAbsent) {
          // The endpoint worked. It simply does not have what was asked for,
          // which is a different fact from being unable to answer — see
          // `RpcAbsent`. Ask the next one rather than condemning this one.
          absent ??= err;
          continue;
        }
        lastError = err;
        this.quarantined.set(endpoint.url, Date.now() + QUARANTINE_MS);
        this.failures = [
          { url: endpoint.url, error: err instanceof Error ? err.message : String(err), at: Date.now() },
          ...this.failures,
        ].slice(0, 20);
      }
    }

    if (absent) {
      // Every endpoint that answered said no. That is an answer, and it is
      // the caller's to interpret — it never arrives dressed as an outage.
      throw absent;
    }

    throw new Error(
      `All ${candidates.length} RPC endpoint(s) failed for this read. ` +
        `Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    );
  }

  /** Probe every endpoint. Returns the ones that answered. */
  async health(probe: (url: string) => Promise<boolean>): Promise<{ healthy: number; total: number }> {
    const results = await Promise.all(
      this.endpoints.map(async (e) => {
        try {
          return await probe(e.url);
        } catch {
          return false;
        }
      }),
    );
    return { healthy: results.filter(Boolean).length, total: this.endpoints.length };
  }
}
