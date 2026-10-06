import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  DEFAULT_LEASE_MS, DEFAULT_TTL_MS, DUPLICATE_WAIT_MS, POLL_INTERVAL_MS,
} from './idempotency-key.js';

/**
 * The durable half of idempotency.
 *
 * `claim` is the only interesting method, and it exists to answer one
 * question correctly under concurrency: *is anybody already doing this?* — on
 * this machine, on the other replica, or in the replica that was rolled last
 * minute.
 *
 * The mechanism is a unique index plus `INSERT ... ON CONFLICT DO NOTHING`.
 * Postgres makes that atomic across every writer that can see the row, so the
 * answer does not depend on which process asks or how many of them there are.
 * A mutex cannot give that: two replicas means two mutexes, and a mutex only
 * ever convinces the process holding it. Redis cannot give it either, not
 * because it is not shared, but because the record of a financial commitment
 * has no business living in something that gets flushed.
 *
 * The three refusals matter as much as the claim, and each is a case where the
 * safe answer is *do not execute*:
 *
 *   fingerprint_mismatch — same key, different request. Replaying here would
 *      hand back a response to a request the caller never made.
 *   in_progress          — someone is mid-flight. Running a second one is the
 *      double purchase.
 *   outcome_unknown      — the instance holding the claim stopped existing.
 *      We cannot tell whether it committed before it died, so re-running could
 *      be the second purchase. Refusing costs the user one error message;
 *      guessing wrong costs them money.
 */

export type ClaimOutcome =
  | { kind: 'owned' }
  | { kind: 'replay'; status: number; body: unknown }
  | { kind: 'conflict'; reason: 'fingerprint_mismatch'; recordedMethod: string; recordedPath: string }
  | { kind: 'in_progress' }
  | { kind: 'abandoned' }
  | { kind: 'contended' };

export interface ClaimParams {
  keyHash: string;
  requestHash: string;
  method: string;
  path: string;
  ttlMs?: number;
  leaseMs?: number;
}

interface StoredRecord {
  id: string;
  state: 'in_progress' | 'completed';
  requestHash: string;
  method: string;
  path: string;
  responseStatus: number | null;
  responseBody: unknown;
  lockedUntil: Date;
  expiresAt: Date;
}

/** Bounded so a pathological race fails as a conflict rather than spinning. */
const MAX_RESOLVE_ATTEMPTS = 3;

@Injectable()
export class IdempotencyStore {
  private readonly logger = new Logger(IdempotencyStore.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Take the key, or explain why it cannot be taken.
   *
   * `createMany({ skipDuplicates: true })` compiles to
   * `INSERT ... ON CONFLICT DO NOTHING`. The count it returns is the whole
   * trick: 1 means this request owns the key, 0 means someone else already
   * does. Postgres blocks the second statement on an uncommitted conflicting
   * insert until that transaction settles, so a count of 0 always comes with
   * the other row visible — there is no window in which "someone else has it"
   * and "I cannot see it" are both true.
   */
  async claim(params: ClaimParams): Promise<ClaimOutcome> {
    const now = new Date();
    const ttlMs = params.ttlMs ?? DEFAULT_TTL_MS;
    const leaseMs = params.leaseMs ?? DEFAULT_LEASE_MS;

    const inserted = await this.prisma.idempotencyRecord.createMany({
      data: [
        {
          keyHash: params.keyHash,
          requestHash: params.requestHash,
          method: params.method,
          path: params.path,
          state: 'in_progress',
          lockedUntil: new Date(now.getTime() + leaseMs),
          expiresAt: new Date(now.getTime() + ttlMs),
        },
      ],
      skipDuplicates: true,
    });

    if (inserted.count === 1) return { kind: 'owned' };

    for (let attempt = 0; attempt < MAX_RESOLVE_ATTEMPTS; attempt += 1) {
      const outcome = await this.resolveExisting(params.keyHash, params.requestHash, ttlMs, leaseMs);
      // A takeover race means the row changed under us; re-read rather than
      // guess, and the attempt cap is what stops that from looping forever.
      if (outcome.kind !== 'retry') return outcome;
    }
    return { kind: 'contended' };
  }

  private async resolveExisting(
    keyHash: string,
    requestHash: string,
    ttlMs: number,
    leaseMs: number,
  ): Promise<ClaimOutcome | { kind: 'retry' }> {
    const row = await this.read(keyHash);
    if (!row) return { kind: 'retry' };

    if (row.requestHash !== requestHash) {
      return {
        kind: 'conflict',
        reason: 'fingerprint_mismatch',
        recordedMethod: row.method,
        recordedPath: row.path,
      };
    }

    if (row.state === 'completed') {
      if (row.expiresAt.getTime() > Date.now()) {
        return { kind: 'replay', status: row.responseStatus ?? 200, body: row.responseBody };
      }
      // Expired: the key is free again. Take it over with a compare-and-swap
      // so two racers cannot both conclude they now own the same key.
      const now = new Date();
      const taken = await this.prisma.idempotencyRecord.updateMany({
        where: { id: row.id, state: 'completed', expiresAt: { lt: now } },
        data: {
          state: 'in_progress',
          responseStatus: null,
          responseBody: Prisma.DbNull,
          completedAt: null,
          lockedUntil: new Date(now.getTime() + leaseMs),
          expiresAt: new Date(now.getTime() + ttlMs),
        },
      });
      if (taken.count === 1) return { kind: 'owned' };
      return { kind: 'retry' };
    }

    // in_progress. The lease is the only evidence of whether the holder is
    // still alive, and it is evidence rather than proof — a holder that is
    // merely slow looks identical to one that has died.
    if (row.lockedUntil.getTime() <= Date.now()) return { kind: 'abandoned' };
    return { kind: 'in_progress' };
  }

  /**
   * Wait for an in-flight claim to finish and hand back its response.
   *
   * Bounded. The caller gets a replayed response in the ordinary case — two
   * presses of a button milliseconds apart is the *normal* shape of this bug —
   * and an explicit "still running" if the original is genuinely slow, rather
   * than a request that hangs until the client's own timeout.
   */
  async awaitCompletion(params: {
    keyHash: string;
    requestHash: string;
    waitMs?: number;
    ttlMs?: number;
    leaseMs?: number;
  }): Promise<ClaimOutcome> {
    const deadline = Date.now() + (params.waitMs ?? DUPLICATE_WAIT_MS);
    let latest: ClaimOutcome | { kind: 'retry' } = { kind: 'in_progress' };

    while (Date.now() < deadline) {
      await sleep(Math.min(POLL_INTERVAL_MS, Math.max(0, deadline - Date.now())));
      const outcome = await this.resolveExisting(
        params.keyHash,
        params.requestHash,
        params.ttlMs ?? DEFAULT_TTL_MS,
        params.leaseMs ?? DEFAULT_LEASE_MS,
      );
      // Keep waiting while the answer is still "someone else is on it" —
      // `in_progress` is the state we are waiting *for*, not a reason to stop.
      // Returning early here would turn the ordinary double tap into a 409,
      // which is precisely the case this whole method exists to make seamless.
      if (outcome.kind !== 'in_progress' && outcome.kind !== 'retry') return outcome;
      latest = outcome;
    }

    // Ran out of patience. Never execute on an ambiguous answer.
    return latest.kind === 'retry' ? { kind: 'contended' } : latest;
  }

  /**
   * Store the response against the claim.
   *
   * Compare-and-swap on `state`, so an instance that has been superseded —
   * because its lease expired and someone else took over — cannot overwrite
   * the record of what actually happened.
   */
  async complete(keyHash: string, status: number, body: unknown): Promise<void> {
    await this.prisma.idempotencyRecord.updateMany({
      where: { keyHash, state: 'in_progress' },
      data: {
        state: 'completed',
        responseStatus: status,
        responseBody: body === null || body === undefined
          ? Prisma.DbNull
          : (body as Prisma.InputJsonValue),
        completedAt: new Date(),
      },
    });
  }

  /**
   * Drop the claim when the handler failed.
   *
   * A failed execution has no response to replay, and leaving the claim behind
   * would make the failure permanent: every retry would return the same error
   * for 24 hours, and a transient outage would silently become a user that can
   * never buy. Deleting is the standard behaviour and it is the right one here
   * because the handlers this wraps do their database write last.
   *
   * The residual risk is stated rather than hidden: if a handler were to
   * commit its work and *then* throw, a retry would run it again. That is why
   * every idempotent route in this codebase does its single write last, and
   * why the abandoned-claim path refuses rather than assumes.
   */
  async release(keyHash: string): Promise<void> {
    await this.prisma.idempotencyRecord.deleteMany({ where: { keyHash, state: 'in_progress' } });
  }

  /** Test and operations helper. Counts nothing that is not visible above. */
  async purgeExpired(): Promise<number> {
    const { count } = await this.prisma.idempotencyRecord.deleteMany({
      where: { state: 'completed', expiresAt: { lt: new Date() } },
    });
    if (count > 0) this.logger.log(`Purged ${count} expired idempotency record(s)`);
    return count;
  }

  private read(keyHash: string): Promise<StoredRecord | null> {
    return this.prisma.idempotencyRecord.findUnique({ where: { keyHash } });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}