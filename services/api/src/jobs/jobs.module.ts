import { Module } from '@nestjs/common';
import { ComplianceModule } from '../compliance/compliance.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PricingModule } from '../pricing/pricing.module.js';
import { ProvidersModule } from '../providers/providers.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { TransactionsModule } from '../transactions/transactions.module.js';
import { CLOCK, SystemClock } from './clock.js';
import { IdempotencyPurgeJob } from './idempotency-purge.job.js';
import { IndexTransactionsJob } from './index-transactions.job.js';
import { JobLockService } from './job-lock.service.js';
import { JobRunStore } from './job-run.store.js';
import { JobScheduler } from './job-scheduler.service.js';
import { JobsController } from './jobs.controller.js';
import { PriceRecordingJob } from '../pricing/price-recording.job.js';
import { NotificationDispatchJob } from './notification-dispatch.job.js';
import { ProviderHealthProbeJob } from './provider-health-probe.job.js';
import { SanctionsRescreenJob } from './sanctions-rescreen.job.js';
import { AttestationFreshnessJob } from './attestation-freshness.job.js';
import { StalePriceFlagJob } from './stale-price-flag.job.js';
import { SwapQuoteExpiryJob } from './swap-quote-expiry.job.js';
import { TransactionIntentExpiryJob } from './transaction-intent-expiry.job.js';
import { JOBS } from './job.js';

/**
 * Every job in one place, in the order they matter.
 *
 * The order is the dependency graph's shape rather than the code's: the purge
 * keeps the idempotency table from growing, the provider probe keeps the
 * registry honest, the two expiry sweeps keep state machines from accumulating
 * rows they have already declared terminal, and the indexer is what puts
 * on-chain activity into those state machines in the first place.
 *
 * `JOBS` is a factory rather than a class so that adding a job is one entry
 * here plus one line in the factory — and so the scheduler has one dependency
 * on the registry instead of one per job, which is what keeps it impossible for
 * a new job to be silently unscheduled.
 *
 * `PricingModule` is imported for `PricingService.MAX_AGE_SECONDS`, the same
 * freshness threshold the API applies when it decides whether a price may be
 * shown. The stale-price job reads that constant rather than declaring its own:
 * two thresholds would drift, and the drift would be invisible.
 */
const JOB_CLASSES = [
  IdempotencyPurgeJob,
  NotificationDispatchJob,
  PriceRecordingJob,
  ProviderHealthProbeJob,
  SwapQuoteExpiryJob,
  StalePriceFlagJob,
  TransactionIntentExpiryJob,
  IndexTransactionsJob,
  SanctionsRescreenJob,
  AttestationFreshnessJob,
] as const;

@Module({
  controllers: [JobsController],
  imports: [ProvidersModule, TransactionsModule, PricingModule, ComplianceModule, SettingsModule, NotificationsModule],
  // Jobs live in JobsModule so the scheduler owns every schedule in one
  // place; the job classes themselves live beside the domains they serve.
  providers: [
    { provide: CLOCK, useClass: SystemClock },
    JobLockService,
    JobRunStore,
    JobScheduler,
    ...JOB_CLASSES,
    {
      provide: JOBS,
      useFactory: (...jobs: unknown[]) => jobs,
      inject: [...JOB_CLASSES],
    },
  ],
  exports: [JobScheduler],
})
export class JobsModule {}
