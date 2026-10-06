import { Inject, Injectable, Logger } from '@nestjs/common';
import { redactDeep } from '@correnthian/security';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  PROVIDER_PROBES,
  type ProbeResult,
  type ProviderProbe,
  type ProviderSubject,
} from './provider-probe.js';

/**
 * Turning probe results into registry state — §33.
 *
 * The registry is what every other module asks before it offers a rail, so a
 * `status` here is not a label: it is a statement the platform acts on. The
 * four rules below are the whole module, and each exists because the obvious
 * alternative is a lie.
 *
 * ## 1. `disabled` is never touched
 *
 * Disabling a provider is a human act with a reason attached. A scheduled job
 * that could re-enable one would be a job that undoes an operator's decision
 * on a timer. Only a probe succeeding can move a provider out of `active`, and
 * nothing here can move one out of `disabled` at all.
 *
 * ## 2. Only a probe that *reached* the provider may write `active`
 *
 * This is the requirement stated bluntly in the brief, and it is enforced by
 * structure rather than by care: `active` is written in one place, inside the
 * `outcome === 'reachable'` branch. A probe that timed out, threw, or does not
 * exist cannot produce that value, so it cannot produce that status.
 *
 * ## 3. `degraded` means "not confirmed healthy", and it is where everything
 *    else lands
 *
 * Including the case the brief names directly: a provider sitting at `active`
 * with nothing verifying it. `active` is a claim that we checked; a job whose
 * purpose is to keep the registry honest cannot leave that claim standing on
 * the strength of never having looked. So an `active` provider that comes back
 * `unreachable` *or* `unavailable` is demoted to `degraded`, and the run
 * record says which of the two it was.
 *
 * That is a deliberate, slightly unfriendly choice, and it is worth stating
 * what it costs: an operator who sets a provider `active` by hand — through
 * `PATCH /providers/:slug/status` — will see it return to `degraded` within
 * one interval unless a probe exists to confirm it. That is the intended
 * behaviour, not a bug: the manual route is for overriding a provider whose
 * probe exists, not for asserting health the system cannot check. The
 * alternative is the registry reading `active` for a provider that has been
 * down for days, which is the state this job was written to end.
 *
 * ## 4. A probe that throws is not evidence about the provider
 *
 * It is evidence that our own probe is broken. Classified `unavailable` with
 * the error in the reason, so an operator can tell "the provider refused us"
 * from "we asked the wrong question" — and so one broken probe does not
 * abandon the rest of the sweep.
 */

/** Caps every list in the run detail. A run record is read, not paginated. */
const MAX_LISTED = 50;

interface ProviderRow {
  id: string;
  slug: string;
  name: string;
  category: ProviderSubject['category'];
  capabilities: string[];
  status: 'active' | 'degraded' | 'disabled';
}

export interface ProviderProbeReport {
  affected: number;
  detail: Record<string, unknown>;
}

@Injectable()
export class ProviderHealthService {
  private readonly logger = new Logger(ProviderHealthService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PROVIDER_PROBES) private readonly probes: readonly ProviderProbe[],
  ) {}

  /**
   * Probe every provider that is not disabled, and write down what we found.
   *
   * `now` comes from the caller so a run has one timestamp rather than one per
   * row — an operator reading `lastCheckedAt` across a sweep expects the sweep
   * to have happened at a moment, not over an interval.
   */
  async probeAll(now: Date): Promise<ProviderProbeReport> {
    const rows = (await this.prisma.provider.findMany({
      select: {
        id: true, slug: true, name: true, category: true,
        capabilities: true, status: true,
      },
      orderBy: { slug: 'asc' },
    })) as ProviderRow[];

    const results: Array<Record<string, unknown>> = [];
    const activated: string[] = [];
    const demoted: string[] = [];
    const skipped: string[] = [];
    let written = 0;

    for (const row of rows) {
      // Rule 1.
      if (row.status === 'disabled') {
        skipped.push(row.slug);
        continue;
      }

      const result = await this.inspect(row);
      const status: 'active' | 'degraded' = result.outcome === 'reachable' ? 'active' : 'degraded';

      const data: Prisma.ProviderUpdateInput = {
        status,
        // Moved on every sweep, whether or not the status changed. A check
        // that happened is news even when it confirmed what we already
        // believed — and a `lastCheckedAt` that only moves when a human looks
        // is what this job exists to fix.
        lastCheckedAt: now,
        lastHealth: {
          probe: {
            outcome: result.outcome,
            at: now.toISOString(),
            category: row.category,
            // Redacted here as well as in the run detail. `lastHealth` is a
            // column on the registry row and the admin renders it, so this is
            // the copy that outlives the run — and a provider error string is
            // a payload from outside our trust boundary.
            ...(result.outcome === 'unreachable' ? { reason: redactDeep(result.reason) } : {}),
            ...(result.outcome === 'unavailable' ? { reason: redactDeep(result.reason) } : {}),
            ...(result.outcome !== 'unavailable' && result.detail ? { detail: result.detail } : {}),
          },
        } as Prisma.InputJsonValue,
      };

      await this.prisma.provider.update({ where: { id: row.id }, data });
      written += 1;

      if (status === 'active' && row.status !== 'active') activated.push(row.slug);
      if (status === 'degraded' && row.status !== 'degraded') demoted.push(row.slug);

      if (results.length < MAX_LISTED) {
        results.push({
          slug: row.slug,
          category: row.category,
          outcome: result.outcome,
          status,
          ...(result.outcome === 'unavailable' || result.outcome === 'unreachable'
            ? { reason: redactDeep(result.reason) }
            : {}),
        });
      }

      if (status === 'degraded') {
        this.logger.warn(
          redactDeep({
            event: 'provider.not_healthy',
            slug: row.slug,
            category: row.category,
            was: row.status,
            now: status,
            outcome: result.outcome,
            reason: result.outcome === 'reachable' ? null : result.reason,
          }),
        );
      }
    }

    return {
      affected: written,
      detail: {
        providers: rows.length,
        written,
        activated,
        demoted,
        skippedDisabled: skipped,
        unprobedCategories: this.unprobedCategories(rows),
        results,
      },
    };
  }

  /**
   * Ask the provider's probe, or explain why there is nothing to ask.
   *
   * A throwing probe is caught here rather than allowed to abort the sweep,
   * and is classified as `unavailable` — see rule 4 in the module header.
   */
  private async inspect(row: ProviderRow): Promise<ProbeResult> {
    const probe = this.probes.find((p) => p.category === row.category);
    if (!probe) {
      return {
        outcome: 'unavailable',
        reason:
          `No health probe is registered for category "${row.category}". ` +
          'No adapter exists for it in this deployment, so its health cannot be established and it is not reported as healthy.',
      };
    }

    try {
      return await probe.probe({
        id: row.id,
        slug: row.slug,
        name: row.name,
        category: row.category,
        capabilities: row.capabilities,
        status: row.status,
      });
    } catch (err) {
      return {
        outcome: 'unavailable',
        reason: `The "${row.category}" probe threw: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /** Which categories nothing in this deployment can check. Visible, not silent. */
  private unprobedCategories(rows: ProviderRow[]): string[] {
    const registered = new Set(this.probes.map((p) => p.category));
    return [...new Set(rows.map((r) => r.category))].filter((c) => !registered.has(c)).sort();
  }
}
