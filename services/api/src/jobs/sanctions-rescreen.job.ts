import { Inject, Injectable, Logger } from '@nestjs/common';
import { KycService } from '../compliance/kyc.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SystemSettingsService } from '../settings/system-settings.service.js';
import type { JobContext, JobOutcome, ScheduledJob } from './job.js';

/** Rows per run. Each is a vendor call, so the batch is the rate limit. */
const RESCREEN_BATCH = 100;

/**
 * Re-screen approved users whose sanctions screen went stale — BE-1105 §3.
 *
 * Fiat gates are the enforcement point; this job is early warning. A listed
 * person who never transacts is still caught within ~24h, and the hit lands
 * in the same review queue through the same `rescreen` path the gate uses —
 * one latch, not two. Users a human already froze are not re-screened: the
 * latch holds until decided, and a fresh vendor answer changes nothing.
 *
 * One user's vendor failure never aborts the batch. A sweep that stops at
 * the first timeout would leave everyone after it unscreened, which is how
 * a partial outage becomes a gap rather than a delay.
 */
@Injectable()
export class SanctionsRescreenJob implements ScheduledJob {
  private readonly logger = new Logger(SanctionsRescreenJob.name);

  readonly name = 'compliance.rescreen-stale';
  readonly everyMs = 24 * 60 * 60_000;
  readonly timeoutMs = 5 * 60_000;
  readonly description =
    'Re-screen approved users whose sanctions screen is older than the configured ' +
    'freshness window. Hits latch into the review queue; frozen users are left to ' +
    'their reviewer.';

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(KycService) private readonly kyc: KycService,
    @Inject(SystemSettingsService) private readonly settings: SystemSettingsService,
  ) {}

  async run(ctx: JobContext): Promise<JobOutcome> {
    // The same setting the gate enforces, so the job cannot re-screen on a
    // different schedule than the gate demands. That drift was the reason
    // the constant used to be exported.
    const ttlMs = (await this.settings.get('compliance.sanctions-rescreen-hours')) * 60 * 60_000;
    const staleBefore = new Date(ctx.now.getTime() - ttlMs);
    const due = await this.prisma.kycProfile.findMany({
      where: {
        status: 'approved',
        sanctionsResult: { not: 'hit' },
        OR: [{ sanctionsScreenedAt: null }, { sanctionsScreenedAt: { lt: staleBefore } }],
      },
      orderBy: { sanctionsScreenedAt: 'asc' },
      take: RESCREEN_BATCH,
      select: { userId: true },
    });

    let screened = 0;
    let hits = 0;
    const errors: string[] = [];

    for (const row of due) {
      if (ctx.signal.aborted) break;
      try {
        const out = await this.kyc.rescreen(row.userId, ctx.now);
        screened += 1;
        if (out.result === 'hit') hits += 1;
      } catch (err) {
        errors.push(`${row.userId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (hits > 0) {
      this.logger.warn(`${hits} sanctions hit(s) latched into the review queue`);
    }

    return {
      affected: screened,
      detail: { screened, hits, errors: errors.slice(0, 10) },
    };
  }
}
