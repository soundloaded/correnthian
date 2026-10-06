import type { ProviderCategory, ProviderStatus } from '../generated/prisma/client.js';

/**
 * How a provider's health is established — §33.
 *
 * ## The rule this file exists to make structural
 *
 * **A probe that could not reach a provider must not mark it `active`.** That
 * is not a policy this module tries to remember; it is the shape of the type.
 * `ProbeResult` has a `reachable` outcome and no way to express "healthy but I
 * did not check", so there is no value a probe can return that would let the
 * caller write `active` on a failed check. `ProviderHealthService` writes
 * `active` in exactly one place, guarded by `outcome === 'reachable'`.
 *
 * ## Why `unavailable` is a distinct outcome and not an error
 *
 * "I asked and the provider said no" and "there is nothing to ask" are
 * different facts about the world and they deserve different consequences. The
 * first is evidence about the provider. The second is evidence about *us* —
 * no adapter, no endpoint, no credentials configured — and turning it into
 * `unreachable` would blame a provider for our own missing integration.
 *
 * ## Why the registry can legitimately be empty
 *
 * There is no provider adapter in this repository: `packages/integrations` is
 * `export {}`, no metals or on-ramp provider is contracted, and `Provider` has
 * no URL or credential column by design (see the model's doc comment). A probe
 * that returned `reachable` because a row exists would be a rubber stamp, and
 * this registry would be the thing that made the provider-health claim
 * unfalsifiable — the exact failure the claim exists to prevent.
 *
 * So the registry starts empty, and the service treats an absent probe as
 * `unavailable` rather than as consent. When the first adapter lands, it
 * registers a `ProviderProbe` for its category and every provider in it starts
 * being verified on the next tick.
 */

/** What a probe is allowed to conclude. There is no "assumed healthy". */
export type ProbeResult =
  | {
      outcome: 'reachable';
      /** Small, non-sensitive. Never a credential, never a full URL. */
      detail?: Record<string, unknown>;
    }
  | {
      outcome: 'unreachable';
      /** One line an operator can act on. Never a raw provider error body. */
      reason: string;
      detail?: Record<string, unknown>;
    }
  | {
      outcome: 'unavailable';
      /** Why there is nothing to probe. A gap on our side, stated as such. */
      reason: string;
    };

/** The provider fields a probe may see. Deliberately not the whole row. */
export interface ProviderSubject {
  id: string;
  slug: string;
  name: string;
  category: ProviderCategory;
  capabilities: string[];
  status: ProviderStatus;
}

export interface ProviderProbe {
  readonly category: ProviderCategory;
  /** Shown in the run detail, so an operator knows what was actually asked. */
  readonly description: string;
  probe(provider: ProviderSubject): Promise<ProbeResult>;
}

/** The registry token, mirroring `JOBS`. */
export const PROVIDER_PROBES = 'correnthian:provider-probes';
