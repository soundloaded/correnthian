import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../common/errors.js';
import { hashSessionToken } from './token-hash.js';
import { AuthLinksService } from './auth-links.service.js';

/**
 * One-time links — BE-203.
 *
 * Two properties the tests pin because getting them subtly wrong is the
 * failure mode:
 *
 *  - **Single-use is a predicate, not a flag.** The consume query repeats
 *    the unconsumed-and-unexpired condition on the write, so two requests
 *    racing for the same link match one row between them. A `findUnique`
 *    followed by an `update` would let both through, and a fake that
 *    resolved `updateMany` to `{ count: 1 }` whatever the clause says could
 *    not fail that claim — so the fake below evaluates the guard for real,
 *    and has a hook that lets the row move between the guard and the
 *    mark, which is the race the guard exists for.
 *  - **Unknown is indistinguishable from known.** Requesting a link for an
 *    address nobody holds answers like requesting one for an address
 *    somebody holds, and consuming a bad link answers like consuming a
 *    good one that already died. Anything else is an oracle.
 *
 * The raw token never survives the issue call: what the store holds is the
 * digest, so the spec derives the lookup the same way the service does.
 */

type TokenRow = {
  id: string;
  userId: string;
  purpose: 'magic_link' | 'password_reset';
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
  /** Issue order. Insertion into the map is issue order here, and the
   *  fake's prune reads the map in that order — which is what `orderBy
   *  createdAt asc` means on a table whose clock only moves forward. */
  seq: number;
};

/**
 * The tests construct time; the service reads the wall clock. `T0` is a
 * fixed instant and the rows it dates would be long dead under the
 * service's present — which is the point: an `expired` row dated from the
 * base exercises the same boundary production does, without sleeping.
 * Rows the tests need *live* are dated from the live present, because
 * liveness is measured against the service's `new Date()`, not the
 * test's.
 */
const T0 = Date.now() - 3_600_000;
let initTick = 0;
const row = (hash: string, over: Partial<TokenRow> = {}): TokenRow => ({
  id: `t-${hash.slice(0, 8)}`,
  userId: 'u1',
  purpose: 'magic_link',
  tokenHash: hash,
  expiresAt: new Date(Date.now() + 15 * 60_000),
  usedAt: null,
  // Distinct issue order: the map preserves insertion, so the factory
  // numbers rows in the order it hands them out.
  createdAt: new Date(T0 + 1),
  seq: initTick++,
  ...over,
});

function makePrisma(initial: TokenRow[] = []) {
  const rows = new Map(initial.map((r) => [r.tokenHash, { ...r }]));
  // Per-store issue counter. It lives on the store, not the module —
  // shared mutable state across tests is how a passing suite becomes
  // order-dependent.
  let seq = 0;
  const users = new Map<string, { id: string; email: string; displayName: string; status: string }>([
    ['ada@example.com', { id: 'u1', email: 'ada@example.com', displayName: 'Ada', status: 'active' }],
  ]);
  /** Runs once, between the guard and the mark. The race. */
  let between: (() => void) | null = null;

  const prisma = {
    user: {
      findUnique: vi.fn(
        async ({ where }: { where: { email?: string; id?: string } }) => {
          if (where.id) {
            for (const u of users.values()) if (u.id === where.id) return { ...u };
            return null;
          }
          const email = where.email ?? '';
          const existing = users.get(email);
          if (existing) return { ...existing };
          // Every other address is unknown: the enumeration tests call with
          // addresses the fake refuses to invent, so unknown stays unknown.
          return null;
        },
      ),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
        for (const u of users.values()) {
          if (u.id === where.id) return { id: u.id, email: u.email, role: 'user' };
        }
        throw new Error('record not found');
      }),
      update: vi.fn(async () => ({})),
    },
    session: {
      create: vi.fn(async () => ({})),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    authToken: {
      create: vi.fn(async ({ data }: { data: Omit<TokenRow, 'id' | 'createdAt' | 'seq'> }) => {
        // Random digests collide on an 8-char id prefix in theory; the
        // production column is a cuid. Give the fake its own sequence so
        // the test exercises prune ordering, not hash luck.
        const created: TokenRow = {
          ...data,
          id: `t-${String(seq).padStart(4, '0')}`,
          createdAt: new Date(),
          seq: seq++,
          // The column default: a row nobody has consumed is unused, and
          // the database says so with null, not with a missing key. A fake
          // that leaves it undefined is a fake whose `usedAt === null`
          // filter matches nothing — which is a prune that never prunes.
          usedAt: null,
        };
        rows.set(data.tokenHash, created);
        return created;
      }),
      findMany: vi.fn(
        async (args: {
          where: { userId: string; purpose: TokenRow['purpose']; usedAt: null; expiresAt: { gt: Date } };
          orderBy?: unknown;
          select?: unknown;
        }) => {
          // Assert the shape of the whole read: oldest-first, ids only.
          // The order is the safety argument — the prune deletes from the
          // front, so any other order removes the wrong end. The projection
          // matters because a row that leaks its digest into a prune list
          // is a digest in a place it does not belong.
          expect(args.orderBy).toEqual({ createdAt: 'asc' });
          expect(args.select).toEqual({ id: true });
          const liveRows = [...rows.values()]
            .filter(
              (r) =>
                r.userId === args.where.userId &&
                r.purpose === args.where.purpose &&
                r.usedAt === null &&
                r.expiresAt > args.where.expiresAt.gt,
            )
            .sort((a, b) => a.seq - b.seq);
          return liveRows.map((r) => ({ id: r.id }));
        },
      ),
      deleteMany: vi.fn(async (args: { where: { id: { in: string[] } } }) => {
        let count = 0;
        for (const id of args.where.id.in) {
          for (const [hash, r] of [...rows]) {
            if (r.id === id) {
              rows.delete(hash);
              count += 1;
              break;
            }
          }
        }
        return { count };
      }),
      updateMany: vi.fn(
        async (args: {
          where: { tokenHash: string; purpose: TokenRow['purpose']; usedAt: null; expiresAt: { gt: Date } };
        }) => {
          between?.();
          between = null;
          const r = rows.get(args.where.tokenHash);
          // The guard repeated on the write. A row consumed or expired
          // since the read — or held for the other purpose — matches zero.
          if (
            !r ||
            r.purpose !== args.where.purpose ||
            r.usedAt !== null ||
            !(r.expiresAt.getTime() > args.where.expiresAt.gt.getTime())
          ) {
            return { count: 0 };
          }
          r.usedAt = new Date();
          return { count: 1 };
        },
      ),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { tokenHash: string } }) => {
        const r = rows.get(where.tokenHash);
        if (!r) throw new Error('record not found');
        return { userId: r.userId };
      }),
    },
  };

  return { prisma, rows, race: (fn: () => void) => { between = fn; } };
}

const RAW = 'raw-magic-link-token';
const HASH = hashSessionToken(RAW);

function makeService(store: ReturnType<typeof makePrisma>) {
  const notifications = { enqueue: vi.fn(async (arg: unknown) => arg) };
  const audit = { record: vi.fn(async (_entry: { action?: string }) => ({})) };
  const config = {
    auth: { sessionTtlHours: 1 },
    http: { corsOrigins: ['https://web.example'] },
  } as never;
  const svc = new AuthLinksService(
    store.prisma as never,
    audit as never,
    config,
    notifications as never,
  );
  return { svc, notifications, audit };
}

/** The raw tokens the service issued, in issue order. Randomness is the
 *  service's to mint; the payload the notification carries is the test's
 *  way back to it. */
function issuedRaws(notifications: { enqueue: ReturnType<typeof vi.fn> }): string[] {
  return notifications.enqueue.mock.calls.map((call) => {
    const link = (call[0] as { payload: { link: string } }).payload.link;
    return decodeURIComponent(link.split('token=')[1] as string);
  });
}

describe('requestMagicLink', () => {
  it('enqueues a notification for a known address, and answers identically for an unknown one', async () => {
    const store = makePrisma();
    const { svc, notifications } = makeService(store);

    const known = await svc.requestMagicLink('ada@example.com');
    expect(known.message).toContain('sign-in link is on its way');
    expect(notifications.enqueue).toHaveBeenCalledOnce();
    expect(notifications.enqueue.mock.calls[0]?.[0]).toMatchObject({
      userId: 'u1',
      channel: 'email',
      template: 'auth.magic-link',
    });

    const unknown = await svc.requestMagicLink('nobody@example.com');
    expect(unknown).toEqual(known);
    expect(notifications.enqueue).toHaveBeenCalledOnce();
  });

  it('prunes past the live-link cap, oldest first', async () => {
    const store = makePrisma();
    const { svc, notifications } = makeService(store);
    for (let i = 0; i < AuthLinksService.MAX_LIVE_PER_PURPOSE + 2; i += 1) {
      await svc.requestMagicLink('ada@example.com');
    }
    const raws = issuedRaws(notifications);
    // The store holds one digest per issued link. The survivors are the
    // newest: re-derive the digests from the links the service issued, in
    // issue order. The first two issued are gone; the last is still held.
    const digests = raws.map((raw) => hashSessionToken(raw));
    expect(new Set(digests).size).toBe(digests.length);
    expect(store.rows.size).toBe(AuthLinksService.MAX_LIVE_PER_PURPOSE);
    const survivors = new Set(store.rows.keys());
    expect(survivors.has(digests[0] as string)).toBe(false);
    expect(survivors.has(digests[1] as string)).toBe(false);
    expect(survivors.has(digests[digests.length - 1] as string)).toBe(true);
  });
});

describe('consumeMagicLink', () => {
  it('never persists the raw token — only its digest', async () => {
    const store = makePrisma();
    const { svc } = makeService(store);
    await svc.requestMagicLink('ada@example.com');

    expect(store.rows.has(RAW)).toBe(false);
    expect([...store.rows.keys()].every((h) => /^[0-9a-f]{64}$/.test(h))).toBe(true);
  });

  it('exchanges a live link for a session, exactly once', async () => {
    const store = makePrisma([row(HASH)]);
    const { svc } = makeService(store);

    const first = await svc.consumeMagicLink(RAW, {});
    expect(first.user).toMatchObject({ id: 'u1', email: 'ada@example.com' });
    expect(first.token).toBeTruthy();

    const second = await svc.consumeMagicLink(RAW, {}).catch((e: unknown) => e);
    expect(second).toBeInstanceOf(AppError);
    expect((second as AppError).status).toBe(401);
  });

  it('loses the race cleanly when the row moves between guard and mark', async () => {
    const store = makePrisma([row(HASH)]);
    const { svc } = makeService(store);

    store.race(() => {
      store.rows.get(HASH)!.usedAt = new Date();
    });
    const result = await svc.consumeMagicLink(RAW, {}).catch((e: unknown) => e);

    expect(result).toBeInstanceOf(AppError);
    expect((result as AppError).status).toBe(401);
  });

  it('refuses an expired link, an unknown token, and the wrong purpose identically', async () => {
    const expired = row(hashSessionToken('expired'), { expiresAt: new Date(T0 - 1) });
    const reset = row(hashSessionToken('reset-only'), { purpose: 'password_reset' });
    const store = makePrisma([expired, reset]);
    const { svc } = makeService(store);

    for (const raw of ['expired', 'reset-only', 'never-issued']) {
      const result = await svc.consumeMagicLink(raw, {}).catch((e: unknown) => e);
      expect(result).toBeInstanceOf(AppError);
      expect((result as AppError).message).toBe('That link is not valid. Request a new one.');
    }
  });
});

describe('password reset', () => {
  it('resets the password, consumes the link, and revokes every session', async () => {
    const hashOf = hashSessionToken('reset-raw');
    const store = makePrisma([row(hashOf, { purpose: 'password_reset' })]);
    const { svc, audit } = makeService(store);
    const hash = vi.fn(async () => 'new-digest');

    await svc.resetPassword('reset-raw', 'a brand new password that is long', hash);

    expect(hash).toHaveBeenCalledOnce();
    expect(store.prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { passwordDigest: 'new-digest' },
    });
    expect(store.prisma.session.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    const actions = audit.record.mock.calls.map((call) => call[0]?.action);
    expect(actions).toContain('auth.password-reset.consumed');

    // The link does not work twice.
    const again = await svc.resetPassword('reset-raw', 'another password that is long', hash).catch((e: unknown) => e);
    expect(again).toBeInstanceOf(AppError);
  });
});
