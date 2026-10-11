import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { JobContext, JobOutcome, ScheduledJob } from './job.js';

/** Rows per page. Small enough to stay quick, large enough that the loop below rarely runs twice. */
const FRESHNESS_BATCH = 200;

/**
 * Days of grace per attestation cadence. `none` is absent on purpose: an
 * asset that promised no cadence can never stand past it.
 */
const CADENCE_DAYS: Record<string, number> = {
  monthly: 30,
  quarterly: 91,
  annual: 365,
};

/**
 * Flag enabled assets standing past their own attestation cadence — Task 2.5.
 *
 * Verification, not validation: the job reports and writes nothing. A stale
 * flag here is not a verdict on the backing (that needs counsel-gated
 * criteria from BE-401) — it is the observable fact that the promised
 * attestation rhythm lapsed, feeding the same question the registry's
 * `staleAttestations` counter answers with its fixed 90-day window.
 */
@Injectable()
export class AttestationFreshnessJob implements ScheduledJob {
  private readonly logger = new Logger(AttestationFreshnessJob.name);

  readonly name = 'assets.attestation-freshness';
  readonly everyMs = 24 * 60 * 60_000;
  readonly timeoutMs = 60_000;
  readonly description =
    'List enabled assets past their attestation cadence without a fresh attestation. ' +
    'Reports only; validation criteria stay counsel-gated.';

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async run(ctx: JobContext): Promise<JobOutcome> {
    const stale: string[] = [];
    let checked = 0;
    let cursor: string | undefined;

    // Cursor pages in assetId order: deterministic, complete, and bounded
    // per call. Stops on a short page, an abort, or a nearly spent deadline.
    for (;;) {
      if (ctx.signal.aborted) break;
      if (ctx.deadline.getTime() - ctx.now.getTime() < 5_000) break;
      const rows = await this.prisma.asset.findMany({
        where: {
          enabled: true,
          attestationCadence: { not: 'none' },
          ...(cursor === undefined ? {} : { assetId: { gt: cursor } }),
        },
        orderBy: [{ assetId: 'asc' }],
        take: FRESHNESS_BATCH,
        select: { assetId: true, attestationCadence: true, lastAttestedAt: true },
      });
      if (rows.length === 0) break;
      checked += rows.length;
      for (const row of rows) {
        if (ctx.signal.aborted) break;
        const windowDays = CADENCE_DAYS[row.attestationCadence];
        if (windowDays === undefined) continue;
        // Never attested under a real cadence is stale by definition: silence
        // about reserves is not evidence of reserves.
        if (!row.lastAttestedAt) {
          stale.push(row.assetId);
          continue;
        }
        const dueAt = row.lastAttestedAt.getTime() + windowDays * 86_400_000;
        if (dueAt < ctx.now.getTime()) stale.push(row.assetId);
      }
      if (rows.length < FRESHNESS_BATCH) break;
      cursor = rows[rows.length - 1]!.assetId;
    }

    if (stale.length > 0) {
      this.logger.warn(`${stale.length} asset(s) past attestation cadence: ${stale.slice(0, 5).join(', ')}`);
    }

    return {
      affected: stale.length,
      detail: { checked, stale: stale.slice(0, 50) },
    };
  }
}
