import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { AppModule } from './app.module.js';
import { PrismaService } from './prisma/prisma.service.js';
import { RedisService } from './redis/redis.service.js';
import { CONTRACT_REGISTRY, type Contract } from '@correnthian/contracts';

/**
 * The wire-format contract test.
 *
 * This is the test that closes the gap that cost three incidents: the admin
 * hand-wrote its response types, nothing compared them to what the API
 * actually returns, and each mismatch surfaced as a broken page rather than a
 * failed build.
 *
 * Here the API is booted for real against the development database, every
 * endpoint the console consumes is called, and the response is parsed through
 * the same schema the client infers its types from. A field added, renamed,
 * nested differently or dropped breaks this test rather than a page.
 *
 * Requires the Docker stack: `pnpm db:up`.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * Locally this suite skips when no database is configured, so a contributor
 * without the Docker stack can still run the fast tests.
 *
 * In CI it must never skip. A green build that silently omitted the contract
 * check would be worse than having no check at all — it would assert that
 * drift is impossible while proving nothing. So CI runs it unconditionally and
 * fails if the database is unreachable.
 */
const CI = Boolean(process.env.CI);

describe.skipIf(!HAS_DB && !CI)('API wire-format contracts', () => {
  it('is running rather than skipped', () => {
    if (CI && !HAS_DB) {
      throw new Error(
        'The contract suite cannot skip in CI. The wire-format guarantee is ' +
          'the whole point of this file — fix the database service or the job.',
      );
    }
    expect(HAS_DB).toBe(CI ? true : HAS_DB);
  });

  let app: INestApplication;
  let token: string;
  let prisma: PrismaService;

  /** Ids this suite created, so it can leave the database as it found it. */
  const fixtureQuoteIds: string[] = [];
  /** Oldest first. Named rather than indexed: a test that reads `fxDex` says
   *  what it is checking, and an index says nothing. */
  let fxQuoted = '';
  let fxBroadcast = '';
  let fxDex = '';
  let fixtureAuditId: string | null = null;
  let fixtureActorEmail: string | null = null;
  let fixtureProviderName: string | null = null;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    // Authenticate as the seeded admin so the endpoints behind auth are
    // covered. Configurable because CI seeds its own throwaway account —
    // hardcoding local credentials here would fail the moment the CI seed
    // differs, which is exactly the kind of drift this suite exists to catch.
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: process.env.CONTRACT_TEST_EMAIL ?? 'admin@correnthian.local',
        password: process.env.CONTRACT_TEST_PASSWORD ?? 'correct-horse-battery-staple',
      });
    token = login.body?.token ?? '';

    // Reset the rate limiter before the first request.
    //
    // Every request here is attributed to the one seeded admin, so the whole
    // suite shares that identity's fixed window. Left alone, the suite's result
    // would depend on how recently it last ran: green on a quiet minute, 429
    // on a busy one, for reasons that have nothing to do with the wire format.
    // The limiter is real behaviour and is not what this file is about.
    const redis = app.get(RedisService).raw;
    const used = await redis.keys('correnthian:rate:*');
    if (used.length > 0) await redis.del(used);

    await seedFixtures();
  }, 60_000);

  /**
   * Fixtures, not assumptions.
   *
   * `GET /swaps/quotes` on an empty table returns `{ items: [], nextCursor:
   * null }`, which parses against its contract perfectly. Asserting the schema
   * alone would therefore pass against a route that returned nothing, always.
   * The filters below cannot pass vacuously either: every one of them checks a
   * row this function created, and a filter that silently ignored its query
   * parameter would return the wrong fixture and fail.
   */
  async function seedFixtures() {
    const assets = await prisma.asset.findMany({ take: 2, orderBy: { symbol: 'asc' } });
    if (assets.length < 2) {
      throw new Error(
        'The contract suite needs at least two seeded assets to build quote fixtures. ' +
          'Run `pnpm seed`. A schema assertion against an empty table proves nothing.',
      );
    }
    const [from, to] = assets as [typeof assets[number], typeof assets[number]];
    const chain = await prisma.chain.findFirst();
    if (!chain) throw new Error('The contract suite needs a seeded chain to build quote fixtures.');
    const provider = await prisma.provider.findFirst();

    // Distinct, ordered timestamps: the keyset cursor sorts on createdAt and
    // tie-breaks on id, so rows written in the same millisecond would not
    // prove the tie-break.
    const base = Date.now() - 60_000;
    const created: string[] = [];
    const rows = [
      {
        railKind: 'provider' as const,
        state: 'quoted' as const,
        providerId: null,
        sizeCapUsd: null,
        executionQuality: 'none' as const,
      },
      {
        railKind: 'provider' as const,
        state: 'broadcast' as const,
        providerId: null,
        sizeCapUsd: '25000.00',
        executionQuality: 'thin' as const,
      },
      {
        railKind: 'dex' as const,
        state: 'broadcast' as const,
        providerId: provider?.id ?? null,
        sizeCapUsd: null,
        executionQuality: 'deep' as const,
      },
    ];

    for (const [i, row] of rows.entries()) {
      const createdAt = new Date(base + i * 1000);
      const quote = await prisma.swapQuote.create({
        data: {
          userId: null,
          chainId: chain.id,
          fromAssetId: from.id,
          toAssetId: to.id,
          fromAmountRaw: '100000000',
          toAmountRaw: row.executionQuality === 'none' ? '0' : '98765432',
          notionalUsd: '1250.50',
          priceImpactBps: 12,
          slippageBps: 50,
          minReceivedRaw: '97777777',
          fees: [{ label: 'Correnthian fee', amountUsd: 0, kind: 'correnthian' }],
          railId: 'contract-fixture',
          createdAt,
          expiresAt: new Date(createdAt.getTime() + 60_000),
          ...row,
        },
      });
      created.push(quote.id);
    }
    [fxQuoted, fxBroadcast, fxDex] = [created[0] ?? '', created[1] ?? '', created[2] ?? ''];
    if (!fxQuoted || !fxBroadcast || !fxDex) {
      throw new Error(`Expected three quote fixtures, created ${created.length}.`);
    }
    fixtureQuoteIds.push(...created);

    // One audit entry, so `GET /audit/:id` is exercised against a known row
    // rather than against whatever the database happened to contain.
    const actorEmail = process.env.CONTRACT_TEST_EMAIL ?? 'admin@correnthian.local';
    const actor = await prisma.user.findUnique({ where: { email: actorEmail } });
    if (!actor) throw new Error(`No seeded account for ${actorEmail}; the login above should have failed.`);

    // The suite owns this action name. A run that died before its teardown
    // would otherwise leave a probe behind and fail every later run on the
    // "exactly one row" assertion below.
    await prisma.auditLog.deleteMany({ where: { action: 'contract.spec.probe' } });

    const entry = await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'contract.spec.probe',
        targetType: 'SwapQuote',
        targetId: fxQuoted,
        outcome: 'denied',
        ipAddress: '203.0.113.9',
        metadata: { reason: 'contract-fixture', nested: { ok: true } },
      },
    });
    fixtureAuditId = entry.id;
    fixtureActorEmail = actor.email;
    fixtureProviderName = provider?.name ?? null;
  }

  afterAll(async () => {
    // Fixture teardown. Deleting the audit probe is not a hole in the
    // append-only guarantee — that property is about the application's write
    // path, and this row is one the test created minutes ago. Leaving it
    // behind would put `contract.spec.probe` in an operator's audit view.
    if (fixtureAuditId) await prisma.auditLog.deleteMany({ where: { id: fixtureAuditId } });
    if (fixtureQuoteIds.length > 0) {
      await prisma.swapQuote.deleteMany({ where: { id: { in: fixtureQuoteIds } } });
    }
    await app?.close();
  });

  const get = (path: string) =>
    request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${token}`);

  type QuoteList = Contract<'GET /swaps/quotes'>;
  type QuoteRow = QuoteList['items'][number];

  /** The route sorts by `createdAt desc, id desc`; this is that ordering. */
  const sortsAfter = (later: QuoteRow, earlier: QuoteRow) =>
    new Date(later.createdAt).getTime() < new Date(earlier.createdAt).getTime() ||
    (later.createdAt === earlier.createdAt && later.id < earlier.id);

  /**
   * Walk every page of a keyset listing.
   *
   * Bounded rather than `while (true)`: a cursor that failed to advance would
   * otherwise hang the suite instead of failing it.
   */
  async function walkPages(query: string, maxPages = 25) {
    const seen: QuoteRow[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < maxPages; page += 1) {
      const qs = new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(query)), limit: '1' });
      if (cursor) qs.set('cursor', cursor);
      const res = await get(`/swaps/quotes?${qs.toString()}`);
      expect(res.status, `page ${page} returned ${res.status}`).toBe(200);
      const parsed = CONTRACT_REGISTRY['GET /swaps/quotes'].parse(res.body);
      const first = parsed.items.at(0);
      if (!first) return { rows: seen, exhausted: true };
      seen.push(first);
      cursor = parsed.nextCursor;
      if (!cursor) return { rows: seen, exhausted: true };
    }
    return { rows: seen, exhausted: false };
  }

  const ENDPOINTS: Array<[keyof typeof CONTRACT_REGISTRY, string]> = [
    ['GET /assets', '/assets'],
    ['GET /assets/stats', '/assets/stats'],
    ['GET /users', '/users'],
    ['GET /users/stats', '/users/stats'],
    ['GET /devices/all', '/devices/all'],
    ['GET /devices/stats', '/devices/stats'],
    ['GET /issuers', '/issuers'],
    ['GET /chains', '/chains'],
    ['GET /providers', '/providers'],
    ['GET /swaps/quotes/stats', '/swaps/quotes/stats'],
    ['GET /swaps/quotes', '/swaps/quotes'],
    ['GET /audit', '/audit'],
  ];

  it('authenticates as the seeded admin', () => {
    expect(token).not.toBe('');
  });

  for (const [key, path] of ENDPOINTS) {
    it(`${key} matches its contract`, async () => {
      const res = await request(app.getHttpServer())
        .get(path)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status, `${path} returned ${res.status}: ${JSON.stringify(res.body)}`).toBe(200);

      const parsed = CONTRACT_REGISTRY[key].safeParse(res.body);
      if (!parsed.success) {
        // Print the exact divergence — a bare "invalid" is useless here.
        const detail = parsed.error.issues
          .map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
          .join('\n');
        throw new Error(`${path} does not match its contract:\n${detail}`);
      }
      expect(parsed.success).toBe(true);
    });
  }

  it('GET /users/:id matches its contract', async () => {
    const list = await request(app.getHttpServer())
      .get('/users').set('Authorization', `Bearer ${token}`);
    const id = list.body?.items?.[0]?.id;
    if (!id) return; // no seeded user to check

    const res = await request(app.getHttpServer())
      .get(`/users/${id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const parsed = CONTRACT_REGISTRY['GET /users/:id'].safeParse(res.body);
    expect(parsed.success, JSON.stringify(parsed.error?.issues ?? [], null, 2)).toBe(true);
  });

  it('every failure uses the shared error envelope', async () => {
    const res = await request(app.getHttpServer()).get('/users/not-a-real-id')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body).toHaveProperty('error.code');
    expect(res.body).toHaveProperty('error.message');
    expect(res.body).toHaveProperty('timestamp');
  });

  // --- quotes ---------------------------------------------------------------

  it('GET /swaps/quotes resolves asset symbols and the provider server-side', async () => {
    const res = await get('/swaps/quotes?limit=100');
    expect(res.status).toBe(200);

    const parsed = CONTRACT_REGISTRY['GET /swaps/quotes'].parse(res.body);
    const fixtures = parsed.items.filter((q) => fixtureQuoteIds.includes(q.id));
    // Every fixture is on the first page of a fresh database. If this is ever
    // not true the other assertions in this block are meaningless, so it fails
    // loudly rather than quietly matching nothing.
    expect(fixtures).toHaveLength(fixtureQuoteIds.length);

    for (const quote of fixtures) {
      // Not "is not undefined" — the contract makes these required, and the
      // whole reason the route joins them is that the admin cannot.
      expect(quote.fromAsset.symbol).not.toBe('');
      expect(quote.toAsset.symbol).not.toBe('');
    }

    const withProvider = fixtures.find((q) => q.id === fxDex);
    expect(fixtureProviderName).not.toBeNull();
    expect(withProvider?.provider?.name).toBe(fixtureProviderName);
    expect(withProvider?.provider?.slug).toBeTruthy();

    // The nullable branch matters as much as the populated one: "no provider"
    // is a real answer and must not read as "we forgot to look".
    for (const quote of fixtures.filter((q) => q.railKind === 'provider')) {
      expect(quote.provider).toBeNull();
    }
  });

  it('GET /swaps/quotes filters by state and by railKind', async () => {
    const byState = await get('/swaps/quotes?state=broadcast&limit=100');
    expect(byState.status).toBe(200);
    const broadcast = CONTRACT_REGISTRY['GET /swaps/quotes'].parse(byState.body).items;
    expect(broadcast.length).toBeGreaterThan(0);
    expect(broadcast.every((q) => q.state === 'broadcast')).toBe(true);
    // A route that ignored `state` would return the other two fixtures here.
    expect(broadcast.map((q) => q.id)).toEqual(expect.arrayContaining([fxBroadcast, fxDex]));
    expect(broadcast.map((q) => q.id)).not.toContain(fxQuoted);

    const byRail = await get('/swaps/quotes?railKind=dex&limit=100');
    expect(byRail.status).toBe(200);
    const dex = CONTRACT_REGISTRY['GET /swaps/quotes'].parse(byRail.body).items;
    expect(dex.length).toBeGreaterThan(0);
    expect(dex.every((q) => q.railKind === 'dex')).toBe(true);
    expect(dex.map((q) => q.id)).toContain(fxDex);

    const both = await get('/swaps/quotes?state=quoted&railKind=dex&limit=100');
    expect(both.status).toBe(200);
    const narrowed = CONTRACT_REGISTRY['GET /swaps/quotes'].parse(both.body).items;
    expect(narrowed.every((q) => q.state === 'quoted' && q.railKind === 'dex')).toBe(true);
    expect(narrowed.map((q) => q.id)).not.toContain(fxQuoted);
  });

  it('GET /swaps/quotes caps the page size', async () => {
    const res = await get('/swaps/quotes?limit=101');
    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty('error.code', 'validation_failed');
  });

  it('GET /swaps/quotes rejects a cursor it cannot read', async () => {
    const res = await get('/swaps/quotes?cursor=not-a-real-cursor');
    // Restarting at page one would hide a client bug behind a page that looks
    // correct, so an unreadable cursor is an error and not a default.
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error.code', 'bad_request');
  });

  it('GET /swaps/quotes paginates by keyset without repeating or skipping a row', async () => {
    const first = await get('/swaps/quotes?limit=1');
    expect(first.status).toBe(200);
    const firstPage = CONTRACT_REGISTRY['GET /swaps/quotes'].parse(first.body);
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.nextCursor).toBeTruthy();

    const { rows, exhausted } = await walkPages('');
    expect(exhausted, 'the keyset walk never reached the end of the list').toBe(true);
    expect(rows.length).toBeGreaterThanOrEqual(fixtureQuoteIds.length);
    expect(new Set(rows.map((q) => q.id)).size).toBe(rows.length);

    // The invariant that makes this keyset rather than an offset: every row on
    // a later page sorts strictly after the last row of the page before it.
    for (let i = 1; i < rows.length; i += 1) {
      const previous = rows[i - 1];
      const current = rows[i];
      if (!previous || !current) throw new Error('the keyset walk returned a sparse page');
      expect(sortsAfter(current, previous), `row ${i} is out of order`).toBe(true);
    }

    // The fixtures were written oldest-first, so they must appear in the
    // reverse order on a `createdAt desc` listing.
    const known = [fxQuoted, fxBroadcast, fxDex];
    expect(rows.map((q) => known.indexOf(q.id)).filter((i) => i !== -1)).toEqual([2, 1, 0]);
  });

  it('GET /swaps/quotes keeps the filter applied across a cursor', async () => {
    const { rows, exhausted } = await walkPages('state=broadcast');
    expect(exhausted).toBe(true);
    expect(rows.every((q) => q.state === 'broadcast')).toBe(true);
    expect(rows.map((q) => q.id)).toEqual(expect.arrayContaining([fxBroadcast, fxDex]));
    expect(rows.map((q) => q.id)).not.toContain(fxQuoted);
  });

  it('GET /swaps/quotes/:id matches its contract', async () => {
    const res = await get(`/swaps/quotes/${fxBroadcast}`);
    expect(res.status, `${res.status}: ${JSON.stringify(res.body)}`).toBe(200);

    const parsed = CONTRACT_REGISTRY['GET /swaps/quotes/:id'].safeParse(res.body);
    if (!parsed.success) {
      const detail = parsed.error.issues.map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
      throw new Error(`/swaps/quotes/:id does not match its contract:\n${detail}`);
    }
    // The two fields the operator reads to decide whether a quote is fillable.
    expect(parsed.data.executionQuality).toBe('thin');
    expect(parsed.data.sizeCapUsd).toBe(25000);
  });

  // --- audit ----------------------------------------------------------------

  it('GET /audit filters by action and resolves the actor to an address', async () => {
    const res = await get('/audit?action=contract.spec.probe');
    expect(res.status).toBe(200);

    const rows = CONTRACT_REGISTRY['GET /audit'].parse(res.body);
    expect(rows).toHaveLength(1);
    const row = rows[0];
    if (!row) throw new Error('the probe row vanished between the count and the assertions');
    expect(row.action).toBe('contract.spec.probe');
    expect(row.outcome).toBe('denied');
    expect(row.ipAddress).toBe('203.0.113.9');
    expect(row.targetType).toBe('SwapQuote');
    // The point of the field: a cuid is not something an operator can act on.
    expect(row.actorEmail).toBe(fixtureActorEmail);
    // The list withholds metadata on purpose; it is read one entry at a time.
    expect(row).not.toHaveProperty('metadata');
  });

  it('GET /audit filters by outcome', async () => {
    const res = await get('/audit?outcome=denied&limit=200');
    expect(res.status).toBe(200);

    const rows = CONTRACT_REGISTRY['GET /audit'].parse(res.body);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.outcome === 'denied')).toBe(true);
    expect(rows.map((r) => r.id)).toContain(fixtureAuditId);
  });

  it('GET /audit/:id matches its contract and returns the redacted metadata', async () => {
    const res = await get(`/audit/${fixtureAuditId}`);
    expect(res.status, `${res.status}: ${JSON.stringify(res.body)}`).toBe(200);

    const parsed = CONTRACT_REGISTRY['GET /audit/:id'].safeParse(res.body);
    if (!parsed.success) {
      const detail = parsed.error.issues.map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
      throw new Error(`/audit/:id does not match its contract:\n${detail}`);
    }
    expect(parsed.data.id).toBe(fixtureAuditId);
    expect(parsed.data.action).toBe('contract.spec.probe');
    expect(parsed.data.actorEmail).toBe(fixtureActorEmail);
    expect(parsed.data.metadata).toMatchObject({ reason: 'contract-fixture', nested: { ok: true } });
  });

  it('GET /audit/:id 404s an entry that does not exist', async () => {
    const res = await get('/audit/00000000000000000000000000');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error.code', 'not_found');
  });
});
