import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service.js';

/**
 * Who is allowed to run a job right now.
 *
 * ## Why Redis, when the record of a financial commitment is in Postgres
 *
 * `IdempotencyStore` argues at length that the record of a financial
 * commitment has no business in something that gets flushed. That argument
 * does not apply here, and it is worth being precise about why.
 *
 * An idempotency record is a *fact about money*: losing it means either
 * replaying a purchase or refusing one that already happened. A job lease is a
 * *statement about who is working*, true for seconds at a time. Losing it
 * costs at most one duplicate run — and every job in this module is written so
 * that a duplicate run is a no-op, because a lease can also be lost by a
 * network partition, a Redis failover, or a process that simply outlived its
 * own TTL. A lock that was only ever correct on a good day would be worse than
 * no lock, because it would be trusted.
 *
 * So: Redis holds the coordination, because coordination is the thing it is
 * for and it is already a hard dependency (the rate limiter fails closed
 * without it). Postgres holds the record, because the record must outlive
 * everything.
 *
 * ## What happens when the holder dies
 *
 * The key carries a PX deadline. A process that stops — crash, SIGKILL, a
 * rolling deploy — stops renewing it, and at most one lease-length later the
 * next instance's tick acquires it and runs the job. Nothing has to notice the
 * death; the expiry is the notice.
 *
 * The run it left behind stays `running` in `JobRun` until the next run marks
 * it `abandoned` — a dead process cannot write its own epitaph, so the next
 * one does. That row is the evidence an operator sees, and it is deliberately
 * not cleaned up quietly.
 *
 * ## Renewal, and why it is a compare-and-swap
 *
 * A long run renews its lease. The renewal is a Lua script that checks the
 * token before extending, not a bare `PEXPIRE`: without the check, a process
 * whose lease had already expired and been taken by someone else would
 * cheerfully extend *their* lease and then believe it still held the lock.
 */

export interface JobLease {
  readonly token: string;
  /** Extend, but only if we still hold it. False means someone else does. */
  extend(ttlMs: number): Promise<boolean>;
  /** Drop it, but only if we still hold it. */
  release(): Promise<void>;
}

const LOCK_PREFIX = 'correnthian:jobs:lock:';

/** Compare-and-swap, in one round trip, so the check cannot race the write. */
const EXTEND_IF_OWNED = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('pexpire', KEYS[1], ARGV[2])
end
return 0
`;

const RELEASE_IF_OWNED = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0
`;

@Injectable()
export class JobLockService {
  private readonly logger = new Logger(JobLockService.name);

  constructor(@Inject(RedisService) private readonly redis: RedisService) {}

  /**
   * Take the job's lease, or report that somebody else has it.
   *
   * `SET NX PX` is atomic in Redis, so exactly one caller wins and the losers
   * learn they lost. There is no read-then-write window to get wrong.
   *
   * **A Redis error is a refusal, not a grant.** If we cannot reach Redis we
   * cannot know whether another instance is mid-run, and "I could not check"
   * is not evidence that nobody is. Same reasoning as the rate limiter failing
   * closed: the cost of a skipped tick is a job that runs a little later, and
   * the cost of the alternative is every replica running the sweep at once.
   */
  async acquire(jobName: string, ttlMs: number): Promise<JobLease | null> {
    const key = `${LOCK_PREFIX}${jobName}`;
    const token = randomUUID();

    let won: string | null;
    try {
      won = await this.redis.raw.set(key, token, { NX: true, PX: ttlMs });
    } catch (err) {
      this.logger.warn(
        `Could not take the lease for ${jobName}; skipping this tick rather than ` +
          `assuming no other instance is running it: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
    if (won !== 'OK') return null;

    return {
      token,
      extend: async (ms: number): Promise<boolean> => {
        const result = await this.redis.raw.eval(EXTEND_IF_OWNED, {
          keys: [key],
          arguments: [token, String(ms)],
        });
        return Number(result) === 1;
      },
      release: async (): Promise<void> => {
        await this.redis.raw.eval(RELEASE_IF_OWNED, { keys: [key], arguments: [token] });
      },
    };
  }

  /** How long the current holder has left. For diagnostics and tests only. */
  async ttlMs(jobName: string): Promise<number> {
    try {
      return await this.redis.raw.pTTL(`${LOCK_PREFIX}${jobName}`);
    } catch {
      return -2;
    }
  }
}
