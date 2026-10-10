import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KycService } from './kyc.service.js';
import { FakeScreeningProvider } from './screening/fake-screening.provider.js';
import type { ParsedWebhookEvent } from './screening/screening-provider.js';

/**
 * The verification state machine — BE-1101 §1.
 *
 * Three properties carry the whole design, and each has a test that fails
 * if it regresses:
 *
 *  - `User.kycStatus` mirrors the profile in the same transaction. Two
 *    columns saying different things about one person is how a gate checks
 *    one and the console shows the other.
 *  - A clean pass approves with no human; anything else parks. A machine
 *    decline never finalises a rejection — false declines are support
 *    tickets, false approvals are legal exposure.
 *  - A sanctions hit latches. Later screens record but never unfreeze;
 *    only the review decision clears it.
 */

type Row = Record<string, unknown>;

function makePrisma() {
  const users = new Map<string, Row>([
    ['u1', { id: 'u1', email: 'u1@example.test', kycStatus: 'not_started' }],
  ]);
  const profiles = new Map<string, Row>();
  const events = new Set<string>();

  const prisma = {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        users.get(where.id) ? { ...users.get(where.id) } : null,
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = users.get(where.id);
        if (!row) throw new Error('record not found');
        Object.assign(row, data);
        return { ...row };
      },
    },
    kycProfile: {
      findUnique: async ({ where }: { where: { userId: string } }) => {
        const row = profiles.get(where.userId);
        return row ? { ...row } : null;
      },
      upsert: async ({ where, create, update }: { where: { userId: string }; create: Row; update: Row }) => {
        const existing = profiles.get(where.userId);
        if (existing) {
          Object.assign(existing, update);
          return { ...existing };
        }
        // The real table fills these by default; the fake must too, or a
        // test asserting `needsReview: false` after a clean pass would fail
        // on `undefined` — testing the fake's amnesia rather than the code.
        const row = {
          id: `kyc_${where.userId}`,
          sanctionsResult: null,
          sanctionsScreenedAt: null,
          needsReview: false,
          reviewedBy: null,
          reviewedAt: null,
          lastDecisionAt: null,
          ...create,
        };
        profiles.set(where.userId, row);
        return { ...row };
      },
      update: async ({ where, data }: { where: { userId: string }; data: Row }) => {
        const row = profiles.get(where.userId);
        if (!row) throw new Error('record not found');
        Object.assign(row, data);
        return { ...row };
      },
    },
    webhookEvent: {
      create: async ({ data }: { data: { provider: string; eventId: string } }) => {
        const key = `${data.provider}:${data.eventId}`;
        if (events.has(key)) {
          const err = new Error('Unique constraint failed on (provider, eventId)');
          (err as unknown as { code: string }).code = 'P2002';
          throw err;
        }
        events.add(key);
        return { ...data, id: `evt_${events.size}`, receivedAt: new Date() };
      },
    },
    $transaction: async <T>(steps: Array<Promise<T>> | ((tx: never) => Promise<T>)): Promise<T> => {
      // The fake has no real transactions; what matters is that both writes
      // happen through one call, so a reader of the service sees the mirror
      // is atomic by construction rather than by coincidence.
      if (typeof steps === 'function') return steps(prisma as never) as Promise<T>;
      const out: T[] = [];
      for (const s of steps) out.push(await s);
      return out as unknown as T;
    },
  };
  return { prisma, users, profiles, events };
}

const audit = { record: vi.fn(async () => {}) };

function setup() {
  const store = makePrisma();
  const screening = new FakeScreeningProvider();
  const svc = new KycService(store.prisma as never, screening, audit as never);
  return { store, screening, svc };
}

const T0 = new Date('2026-10-10T10:00:00.000Z');

function decisionEvent(over: Partial<ParsedWebhookEvent> = {}): ParsedWebhookEvent {
  return {
    eventId: 'evt_1',
    inquiryId: 'inq_1',
    referenceId: 'u1',
    occurredAt: T0,
    decision: { verdict: 'passed', watchlist: 'clean', codes: ['pass'], occurredAt: T0 },
    ...over,
  };
}

describe('startVerification', () => {
  it('opens a pending profile and mirrors the user row in the same call', async () => {
    const { store, screening, svc } = setup();
    screening.scriptCreate('u1', { inquiryId: 'inq_1', sessionToken: 'sess_1' });

    const out = await svc.startVerification('u1');

    expect(out).toEqual({ status: 'pending', inquiryId: 'inq_1', sessionToken: 'sess_1' });
    expect(store.profiles.get('u1')).toMatchObject({
      status: 'pending',
      providerRef: 'inq_1',
      provider: 'fake',
    });
    expect(store.users.get('u1')?.['kycStatus']).toBe('pending');
  });

  it('re-entry while pending returns the live inquiry instead of a second one', async () => {
    const { screening, svc } = setup();
    screening.scriptCreate('u1', { inquiryId: 'inq_1', sessionToken: 'sess_1' });
    await svc.startVerification('u1');

    const again = await svc.startVerification('u1');
    expect(again.inquiryId).toBe('inq_1');
    expect(screening.calls.createInquiry).toHaveLength(1);
  });

  it('refuses an unknown user without calling the vendor', async () => {
    const { screening, svc } = setup();
    await expect(svc.startVerification('ghost')).rejects.toThrow(/not found/i);
    expect(screening.calls.createInquiry).toHaveLength(0);
  });
});

describe('applyWebhookEvent', () => {
  async function pending() {
    const ctx = setup();
    ctx.screening.scriptCreate('u1', { inquiryId: 'inq_1', sessionToken: 'sess_1' });
    await ctx.svc.startVerification('u1');
    audit.record.mockClear();
    return ctx;
  }

  it('auto-approves a clean pass with no human involved', async () => {
    const { store, svc } = await pending();

    const out = await svc.applyWebhookEvent(decisionEvent());

    expect(out).toEqual({ applied: true, status: 'approved' });
    expect(store.profiles.get('u1')).toMatchObject({
      status: 'approved',
      sanctionsResult: 'clean',
      needsReview: false,
      reviewedBy: null,
    });
    expect(store.users.get('u1')?.['kycStatus']).toBe('approved');
  });

  it('parks a needs_review verdict instead of deciding it', async () => {
    const { store, svc } = await pending();

    const out = await svc.applyWebhookEvent(decisionEvent({
      eventId: 'evt_2',
      decision: { verdict: 'needs_review', watchlist: 'clean', codes: ['review'], occurredAt: T0 },
    }));

    expect(out).toEqual({ applied: true, status: 'pending' });
    expect(store.profiles.get('u1')).toMatchObject({ status: 'pending', needsReview: true });
    expect(store.users.get('u1')?.['kycStatus']).toBe('pending');
  });

  it('a machine decline never finalises a rejection', async () => {
    const { store, svc } = await pending();

    await svc.applyWebhookEvent(decisionEvent({
      eventId: 'evt_3',
      decision: { verdict: 'declined', watchlist: 'clean', codes: ['id_mismatch'], occurredAt: T0 },
    }));

    // Parked, not rejected. False declines are support tickets; the operator
    // confirms or the user retries. Only a human writes `rejected`.
    expect(store.profiles.get('u1')).toMatchObject({ status: 'pending', needsReview: true });
  });

  it('latches a sanctions hit and never auto-clears it', async () => {
    const { store, svc } = await pending();

    await svc.applyWebhookEvent(decisionEvent({
      eventId: 'evt_4',
      decision: { verdict: 'passed', watchlist: 'hit', codes: ['watchlist'], occurredAt: T0 },
    }));

    // Verification passed but the lists matched: the person does not get
    // approved on a machine's say-so, and the freeze stays for review.
    expect(store.profiles.get('u1')).toMatchObject({
      status: 'pending',
      needsReview: true,
      sanctionsResult: 'hit',
    });
    expect(store.users.get('u1')?.['kycStatus']).toBe('pending');

    // A later clean screen records without unfreezing.
    const later = new Date(T0.getTime() + 3_600_000);
    await svc.applyWebhookEvent(decisionEvent({
      eventId: 'evt_5',
      occurredAt: later,
      decision: { verdict: 'passed', watchlist: 'clean', codes: ['pass'], occurredAt: later },
    }));
    expect(store.profiles.get('u1')).toMatchObject({ sanctionsResult: 'hit', needsReview: true });
  });

  it('ignores a duplicate event without applying it twice', async () => {
    const { store, svc } = await pending();

    await svc.applyWebhookEvent(decisionEvent());
    const out = await svc.applyWebhookEvent(decisionEvent());

    expect(out).toEqual({ applied: false, reason: 'duplicate' });
    expect(store.profiles.get('u1')?.['sanctionsResult']).toBe('clean');
  });

  it('rejects an event for an inquiry the user does not hold', async () => {
    const { store, svc } = await pending();

    const out = await svc.applyWebhookEvent(decisionEvent({ eventId: 'evt_9', inquiryId: 'inq_other' }));

    // Signature proves it came from the vendor, not that it is ours.
    expect(out).toEqual({ applied: false, reason: 'unbound' });
    expect(store.profiles.get('u1')?.['status']).toBe('pending');
  });

  it('rejects an event that names no user we know', async () => {
    const { screening, svc } = setup();
    void screening;
    const out = await svc.applyWebhookEvent(decisionEvent({ referenceId: 'ghost' }));
    expect(out).toEqual({ applied: false, reason: 'unknown_user' });
  });

  it('acknowledges-and-ignores a stale event that arrives after a newer decision', async () => {
    const { store, svc } = await pending();
    const later = new Date(T0.getTime() + 3_600_000);

    await svc.applyWebhookEvent(decisionEvent({ occurredAt: later }));
    const out = await svc.applyWebhookEvent(decisionEvent({ eventId: 'evt_old', occurredAt: T0 }));

    expect(out).toEqual({ applied: false, reason: 'stale' });
    expect(store.profiles.get('u1')?.['lastDecisionAt']).toEqual(later);
  });
});

describe('rescreen', () => {
  it('records a clean screen without touching verification status', async () => {
    const { store, screening, svc } = setup();
    screening.scriptCreate('u1', { inquiryId: 'inq_1', sessionToken: 'sess_1' });
    await svc.startVerification('u1');
    screening.scriptScreen('u1', 'clean');

    const out = await svc.rescreen('u1', new Date(T0.getTime() + 100_000));

    expect(out.result).toBe('clean');
    expect(store.profiles.get('u1')).toMatchObject({ sanctionsResult: 'clean', needsReview: false });
  });

  it('a hit freezes into the review queue', async () => {
    const { store, screening, svc } = setup();
    screening.scriptCreate('u1', { inquiryId: 'inq_1', sessionToken: 'sess_1' });
    await svc.startVerification('u1');
    screening.scriptScreen('u1', 'hit');

    await svc.rescreen('u1', new Date(T0.getTime() + 100_000));

    expect(store.profiles.get('u1')).toMatchObject({ sanctionsResult: 'hit', needsReview: true });
  });
});
