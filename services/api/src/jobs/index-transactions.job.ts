import { Inject, Injectable, Logger } from '@nestjs/common';
import { TransactionIndexingService } from '../blockchain/transaction-indexing.service.js';
import { JobRunStore } from './job-run.store.js';
import type { JobContext, JobOutcome, ScheduledJob } from './job.js';

/** Chains whose resume point is carried in the run record under this key. */
const CURSOR_KEY = 'cursor';

/** Runs of history to look back through for a usable cursor. */
const CURSOR_LOOKBACK_RUNS = 20;

/** Errors worth storing on the run before the detail stops being readable. */
const MAX_ERRORS = 10;

/**
 * Keep the transaction ledger telling the truth about the chain. BE-302.
 *
 * Two questions this job exists to answer, neither of which anything else in
 * the system was answering:
 *
 * **What did a wallet receive?** A deposit is not filed by anyone — the user
 * did not create it, Correnthian did not route it. Until this ran, an inbound
 * transfer appeared in a balance and nowhere in history, which is the gap a
 * self-custodial product cannot have, because the history is the evidence that
 * the metal is theirs.
 *
 * **Has it confirmed?** `TransactionsService.observe` has always known how to
 * move a row with depth, and nothing called it. Confirmations therefore froze
 * at whatever a client happened to report, so a settled transfer could sit at
 * `pending` forever. The depth sweep inside `indexChain` drives that now.
 *
 * ## Why the cursor lives in the run record
 *
 * The scan resumes from where the last *successful* run finished, and that
 * number is read back out of `JobRun.detail` — a column that already exists,
 * is already redacted, is already retained for 30 days, and is already the
 * place jobs record "how far I got". A dedicated column would be tidier and
 * would need a migration, and against a shared database `prisma migrate dev`
 * is exactly the operation `DEF-003` says never to run.
 *
 * Every failure mode of this arrangement falls back *backwards*, never
 * forwards: a crashed run writes no detail, a failed run is not `succeeded`,
 * and 200 pruned records leave nothing to read — so the scan starts from a
 * fixed trailing window instead. The cost of losing the cursor is redundant
 * work, never a silent gap. The one gap that is not recoverable is stated
 * rather than hidden: see `SCAN_WINDOW_BLOCKS`.
 */
@Injectable()
export class IndexTransactionsJob implements ScheduledJob {
  private readonly logger = new Logger(IndexTransactionsJob.name);

  readonly name = 'blockchain.index-transactions';
  readonly everyMs = 60_000;
  readonly timeoutMs = 50_000;
  readonly description =
    'Scan recent blocks for ERC-20 transfers to and from registered wallets, write one ' +
    'Transaction row per hash, and advance or demote every row on that chain to the ' +
    'confirmation depth its current head implies. Read-only against the chain.';

  constructor(
    @Inject(TransactionIndexingService) private readonly indexing: TransactionIndexingService,
    @Inject(JobRunStore) private readonly runs: JobRunStore,
  ) {}

  async run(ctx: JobContext): Promise<JobOutcome> {
    const cursors = await this.readCursors();
    const chainIds = await this.indexing.enabledChainIds();

    const chains: Array<{
      chainId: string;
      cursor: string | null;
      head: string | null;
      complete: boolean;
      created: number;
      advanced: number;
      depthChanged: number;
      errors: string[];
    }> = [];

    for (const chainId of chainIds) {
      if (ctx.signal.aborted) break;
      try {
        const report = await this.indexing.indexChain({
          chainId,
          resumeFrom: cursors[chainId] ?? null,
          signal: ctx.signal,
          now: ctx.now,
        });
        chains.push({
          chainId,
          cursor: report.scannedTo,
          head: report.head,
          complete: report.complete,
          created: report.rowsCreated,
          advanced: report.rowsAdvanced,
          depthChanged: report.depthChanged,
          errors: report.errors,
        });
      } catch (err) {
        // One chain's RPC being down must not stop the others; the failure is
        // recorded and the whole run only fails if nothing progressed at all.
        chains.push({
          chainId,
          cursor: null,
          head: null,
          complete: false,
          created: 0,
          advanced: 0,
          depthChanged: 0,
          errors: [err instanceof Error ? err.message : String(err)],
        });
      }
    }

    const created = chains.reduce((n, c) => n + c.created, 0);
    const advanced = chains.reduce((n, c) => n + c.advanced, 0);
    const depthChanged = chains.reduce((n, c) => n + c.depthChanged, 0);
    const affected = created + advanced + depthChanged;
    const allErrors = chains.flatMap((c) => c.errors.map((e) => `${c.chainId}: ${e}`));
    const progressed = chains.some((c) => c.cursor !== null);

    if (allErrors.length > 0 && !progressed) {
      // Nothing was scanned and something went wrong. Reported as a failure so
      // it is visible in the run history, and so the cursor falls back to the
      // window rather than recording progress that did not happen.
      throw new Error(
        `No chain could be scanned: ${allErrors.slice(0, MAX_ERRORS).join('; ')}`,
      );
    }

    if (affected > 0) {
      this.logger.log(
        `Indexed ${created} new and ${advanced} seen transaction(s); ` +
          `${depthChanged} row(s) moved with depth`,
      );
    }

    return {
      affected,
      detail: {
        // Read back by the next run. Only a completed range goes here.
        [CURSOR_KEY]: Object.fromEntries(
          chains.filter((c) => c.cursor !== null).map((c) => [c.chainId, c.cursor]),
        ),
        head: Object.fromEntries(
          chains.filter((c) => c.head !== null).map((c) => [c.chainId, c.head]),
        ),
        incomplete: chains.filter((c) => !c.complete).map((c) => c.chainId),
        created,
        advanced,
        depthChanged,
        errors: allErrors.slice(0, MAX_ERRORS),
      },
    };
  }

  /**
   * Where each chain's last successful run finished.
   *
   * `succeeded` only: a run that failed wrote a `head` it did not actually
   * scan, and resuming from that would skip the gap. The current run is still
   * `running` while this is read, so it can never be mistaken for a predecessor.
   */
  private async readCursors(): Promise<Record<string, bigint>> {
    try {
      const history = await this.runs.history(this.name, CURSOR_LOOKBACK_RUNS);
      const prior = history.find((r) => r.outcome === 'succeeded' && r.detail);
      const stored = prior?.detail?.[CURSOR_KEY];
      if (!stored || typeof stored !== 'object') return {};

      const out: Record<string, bigint> = {};
      for (const [chainId, value] of Object.entries(stored as Record<string, unknown>)) {
        if (typeof value !== 'string' || !/^\d+$/.test(value)) continue;
        out[chainId] = BigInt(value);
      }
      return out;
    } catch (err) {
      // A cursor that cannot be read is a cursor that starts a window scan,
      // which re-does work rather than skipping it.
      this.logger.warn(
        `Could not read the previous run's cursor: ${err instanceof Error ? err.message : String(err)}`,
      );
      return {};
    }
  }
}
