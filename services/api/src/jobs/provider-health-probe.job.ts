import { Inject, Injectable, Logger } from '@nestjs/common';
import { ProviderHealthService } from '../providers/provider-health.service.js';
import type { JobContext, JobOutcome, ScheduledJob } from './job.js';

/**
 * Keep the provider registry from claiming health it has not verified — §33.
 *
 * `GET /providers/health` reported whatever was in the table, and
 * `lastCheckedAt` only moved when a human looked. That is the state the brief
 * describes as the problem: a provider can be unreachable for days while the
 * registry reads `active`, and every consumer of the registry takes that as a
 * yes.
 *
 * The rules that decide what gets written live in `ProviderHealthService` —
 * this job is the caller and owns nothing but the cadence. Notably, the single
 * most important one is enforced there rather than here: **a probe that could
 * not reach a provider never marks it `active`**, and neither does the absence
 * of any way to probe it.
 *
 * ## Why it runs more often than anything else here
 *
 * Provider status gates whether a rail is offered at all, so the cost of
 * finding out late is a user being offered a rail that is down. Two minutes is
 * a compromise between that and not spending the provider's rate limit on
 * checking on it. It matters more than it looks: a probe is the only thing
 * standing between a dead provider and a confident registry, and a check that
 * runs every fifteen minutes has already let a user try.
 */
@Injectable()
export class ProviderHealthProbeJob implements ScheduledJob {
  private readonly logger = new Logger(ProviderHealthProbeJob.name);

  readonly name = 'provider.health-probe';
  readonly everyMs = 2 * 60_000;
  readonly timeoutMs = 60_000;
  readonly description =
    'Probe providers that are not disabled and write status, lastCheckedAt and the last probe ' +
    'result. Only a probe that reached a provider marks it active; anything else is degraded.';

  constructor(@Inject(ProviderHealthService) private readonly health: ProviderHealthService) {}

  async run(ctx: JobContext): Promise<JobOutcome> {
    const report = await this.health.probeAll(ctx.now);

    if (report.affected > 0) {
      this.logger.log(
        `Checked ${report.affected} provider(s); the run detail names every status change and why`,
      );
    }

    return report;
  }
}
