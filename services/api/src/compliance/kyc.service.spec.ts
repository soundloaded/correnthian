import { describe, expect, it, vi } from 'vitest';
import { assertReason } from '../audit/audit.service.js';
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
    ['u2', { id: 'u2', email: 'u2@example.test', kycStatus: 'not_started' }],
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
      findFirst: async ({ where }: { where: { providerRef?: string } }) => {
        // The inquiry-id reverse lookup: inquiry ids are vendor-unique and
        // each profile holds at most one, so first is only.
        const found = [...profiles.values()].find((r) => r['providerRef'] === where.providerRef);
        return found ? { ...found } : null;
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
        // The real table bumps this on every write (@updatedAt); the fake
        // must too, or ordering tests assert on a clock that never moves.
        Object.assign(row, data, { updatedAt: new Date() });
        return { ...row };
      },
      findMany: async (args?: { where?: Row; orderBy?: Row; take?: number }) => {
        let out = [...profiles.values()];
        if (args?.where?.needsReview !== undefined) {
          out = out.filter((r) => r['needsReview'] === args?.where?.['needsReview']);
        }
        out = [...out].sort(
          (a, b) =>
            new Date(a['updatedAt'] as string ?? 0).getTime() -
            new Date(b['updatedAt'] as string ?? 0).getTime(),
        );
        if (args?.take) out = out.slice(0, args.take);
        return out.map((r) => ({
          ...r,
          user: { id: r['userId'], email: users.get(r['userId'] as string)?.['email'] },
          updatedAt: new Date(),
        }));
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

const audit = {
  record: vi.fn(async () => {}),
  // The real one, not a stub: "a reason is required" is the property under
  // test and a `vi.fn()` would assert nothing.
  assertReason,
};

function setup() {
  const store = makePrisma();
  const screening = new FakeScreeningProvider();
  const svc = new KycService(store.prisma as never, screening, audit as never);
  return { store, screening, svc };
}

const T0 = new Date('2026-10-10T10:00:00.000Z');
const HOUR = 3_600_000;

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

describe('documented shapes, applied independently', () => {
  async function pending() {
    const ctx = setup();
    ctx.screening.scriptCreate('u1', { inquiryId: 'inq_1', sessionToken: 'sess_1' });
    await ctx.svc.startVerification('u1');
    audit.record.mockClear();
    return ctx;
  }

  it('an approval with no list signal approves without inventing a screen', async () => {
    const { store, svc } = await pending();

    const out = await svc.applyWebhookEvent(decisionEvent({
      decision: { verdict: 'passed', watchlist: null, codes: ['inquiry.approved'], occurredAt: T0 },
    }));

    expect(out).toEqual({ applied: true, status: 'approved' });
    expect(store.profiles.get('u1')).toMatchObject({ status: 'approved' });
    // No list fact arrived, so none is written: a clean screen here would
    // be invented, and the gate would trust it for 24 hours.
    expect(store.profiles.get('u1')?.['sanctionsResult']).toBeNull();
    expect(store.users.get('u1')?.['kycStatus']).toBe('approved');
  });

  it('binds by inquiry id when the event carries no reference', async () => {
    const { store, svc } = await pending();

    const out = await svc.applyWebhookEvent(decisionEvent({
      eventId: 'evt_noref',
      referenceId: null,
      decision: { verdict: 'passed', watchlist: null, codes: ['inquiry.approved'], occurredAt: T0 },
    }));

    expect(out).toEqual({ applied: true, status: 'approved' });
    expect(store.users.get('u1')?.['kycStatus']).toBe('approved');
  });

  it('notes a dismissal without deciding: only our operator clears a latch', async () => {
    const { store, svc } = await pending();
    await svc.applyWebhookEvent(decisionEvent({
      eventId: 'evt_hit',
      occurredAt: new Date(T0.getTime() + 1000),
      decision: { verdict: null, watchlist: 'hit', codes: ['report/watchlist.matched'], occurredAt: new Date(T0.getTime() + 1000) },
    }));
    expect(store.profiles.get('u1')?.['sanctionsResult']).toBe('hit');

    const out = await svc.applyWebhookEvent(decisionEvent({
      eventId: 'evt_dis',
      occurredAt: new Date(T0.getTime() + 2000),
      decision: { verdict: null, watchlist: null, codes: ['report/watchlist.dismissed'], occurredAt: new Date(T0.getTime() + 2000) },
    }));

    expect(out).toEqual({ applied: true, status: 'pending' });
    // Still latched. A dismissal in Persona's dashboard is a human act, but
    // not ours: no operator, no reason, no clearing.
    expect(store.profiles.get('u1')).toMatchObject({ sanctionsResult: 'hit', needsReview: true });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'webhook.noted' }));
  });

  it('notes unknown future event names instead of breaking on them', async () => {
    const { svc } = await pending();

    const out = await svc.applyWebhookEvent(decisionEvent({
      eventId: 'evt_future',
      decision: { verdict: null, watchlist: null, codes: ['inquiry.something-new'], occurredAt: T0 },
    }));

    // Acknowledged, named in the audit trail, applied to nothing. Persona
    // warns new values arrive without versioning; throwing would retry
    // forever on an event that will never apply.
    expect(out).toEqual({ applied: true, status: 'pending' });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'webhook.noted' }));
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

describe('rescreen plumbing', () => {
  it('links the report to the profile inquiry rather than screening nobody', async () => {
    const { store } = setup();
    const rescreen = vi.fn(async () => ({ result: 'clean' as const, screenedAt: new Date() }));
    const scoped = new KycService(store.prisma as never, { rescreen } as never, audit as never);
    store.profiles.set('u1', {
      id: 'kyc_u1', userId: 'u1', status: 'approved', providerRef: 'inq_linked',
      sanctionsResult: 'clean', sanctionsScreenedAt: new Date(T0.getTime() - 100_000),
      needsReview: false,
    });

    await scoped.rescreen('u1', T0);

    // The report must name its inquiry: an unlinked screen answers about
    // nobody, and the gate would file it against the wrong question.
    expect(rescreen).toHaveBeenCalledWith('u1', 'inq_linked');
  });

  it('refuses to screen a user with no profile instead of inventing one', async () => {
    const { svc } = setup();
    await expect(svc.rescreen('ghost', T0)).rejects.toThrow(/no verification profile/i);
  });
});

describe('decide — the only path that rejects or clears a hit', () => {
  async function parked() {
    const ctx = setup();
    ctx.screening.scriptCreate('u1', { inquiryId: 'inq_1', sessionToken: 'sess_1' });
    await ctx.svc.startVerification('u1');
    await ctx.svc.applyWebhookEvent(decisionEvent({
      eventId: 'evt_park',
      decision: { verdict: 'needs_review', watchlist: 'clean', codes: ['review'], occurredAt: T0 },
    }));
    audit.record.mockClear();
    return ctx;
  }

  it('approve clears the flag, mirrors approved, and records who decided and why', async () => {
    const { store, svc } = await parked();

    const out = await svc.decide('u1', 'op1', 'approve', 'Documents verified against issuer records.');

    expect(out).toEqual({ status: 'approved' });
    expect(store.profiles.get('u1')).toMatchObject({
      status: 'approved',
      needsReview: false,
      reviewedBy: 'op1',
    });
    expect(store.profiles.get('u1')?.['reviewedAt']).toBeInstanceOf(Date);
    expect(store.users.get('u1')?.['kycStatus']).toBe('approved');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'op1',
      action: 'kyc.approved',
      reason: 'Documents verified against issuer records.',
    }));
  });

  it('approve is the one human act that clears a latched sanctions hit', async () => {
    const { store, svc } = await parked();
    await svc.applyWebhookEvent(decisionEvent({
      eventId: 'evt_hit',
      occurredAt: new Date(T0.getTime() + 1000),
      decision: { verdict: 'passed', watchlist: 'hit', codes: ['watchlist'], occurredAt: new Date(T0.getTime() + 1000) },
    }));
    expect(store.profiles.get('u1')?.['sanctionsResult']).toBe('hit');

    await svc.decide('u1', 'op1', 'approve', 'Confirmed false positive with the vendor.');

    expect(store.profiles.get('u1')).toMatchObject({ sanctionsResult: 'clean', needsReview: false });
  });

  it('reject finalises a rejection and leaves the sanctions latch in place', async () => {
    const { store, svc } = await parked();
    // A hit latched before the decision: rejecting the verification must
    // not clear it. The account cannot move fiat either way, and a later
    // review starts from frozen — a rejection quietly unfreezing would let
    // the next approve path skip over a hit nobody re-examined.
    store.profiles.get('u1')!['sanctionsResult'] = 'hit';

    const out = await svc.decide('u1', 'op1', 'reject', 'Identity documents do not match the account holder.');

    expect(out).toEqual({ status: 'rejected' });
    expect(store.profiles.get('u1')).toMatchObject({
      status: 'rejected',
      needsReview: false,
      reviewedBy: 'op1',
      sanctionsResult: 'hit',
    });
    expect(store.users.get('u1')?.['kycStatus']).toBe('rejected');
  });

  it('refuses without a reason: an unexplained decision is not a decision', async () => {
    const { svc } = await parked();
    await expect(svc.decide('u1', 'op1', 'approve', '')).rejects.toThrow(/reason/i);
    await expect(svc.decide('u1', 'op1', 'reject', '  ')).rejects.toThrow(/reason/i);
  });

  it('refuses a profile that is not awaiting review', async () => {
    const { svc } = setup();
    await expect(
      svc.decide('u1', 'op1', 'approve', 'No flag to clear here.'),
    ).rejects.toThrow(/not awaiting review|no verification profile/i);
  });
});

describe('reviewQueue', () => {
  it('lists only flagged profiles, oldest first, without identity documents', async () => {
    const { store, screening, svc } = setup();
    for (const userId of ['u1', 'u2']) {
      screening.scriptCreate(userId, { inquiryId: `inq_${userId}`, sessionToken: 'sess' });
      await svc.startVerification(userId);
      await svc.applyWebhookEvent({
        eventId: `evt_park_${userId}`,
        inquiryId: `inq_${userId}`,
        referenceId: userId,
        occurredAt: T0,
        decision: { verdict: 'needs_review', watchlist: 'clean', codes: [], occurredAt: T0 },
      });
    }
    // u1 parked earlier. Set explicitly: the fake bumps updatedAt on write
    // like the real table, but both parks happened "now", so the test
    // states the order rather than racing the clock.
    store.profiles.get('u1')!['updatedAt'] = new Date(T0.getTime() - HOUR);
    store.profiles.get('u2')!['updatedAt'] = new Date(T0.getTime());

    const rows = await svc.reviewQueue();
    expect(rows.map((r) => r['userId'])).toEqual(['u1', 'u2']);
    expect(rows[0]).toMatchObject({
      userId: 'u1',
      email: 'u1@example.test',
      status: 'pending',
    });
    // No providerRef? It is the inquiry id — operational, not PII, and the
    // operator needs it to open the vendor record. Documents never appear:
    // we never stored any.
    expect(rows[0]?.['providerRef']).toBe('inq_u1');
    expect(JSON.stringify(rows[0])).not.toMatch(/document|biometric|image/i);

    const empty = setup();
    expect(await empty.svc.reviewQueue()).toEqual([]);
  });
});
