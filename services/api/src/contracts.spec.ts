import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { AppModule } from './app.module.js';
import { PrismaService } from './prisma/prisma.service.js';
import { RedisService } from './redis/redis.service.js';
import { CONTRACT_REGISTRY, type Contract } from '@correnthian/contracts';
import { applyApiVersioning } from './versioning/apply-versioning.js';

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

  /**
   * Transaction fixtures.
   *
   * Isolated behind a dedicated wallet so the assertions do not depend on the
   * transaction table being empty — it is shared with every other run against
   * this database, and a listing test that assumes page one is a test that
   * passes until it does not.
   */
  const FIXTURE_WALLET_ADDRESS = '0x00000000000000000000000000000000000000fe';
  const FIXTURE_DESTINATION = '0x00000000000000000000000000000000000000ff';
  let fixtureWalletId = '';
  let fixtureAssetRef = '';
  const fixtureTxIds: string[] = [];
  /** Every request this suite made that should leave an audit line. */
  const requestIds: string[] = [];

  /**
   * Redemption fixtures.
   *
   * Built rather than assumed for the same reason the transaction fixtures
   * are: the development seed deliberately ships a non-redeemable asset and a
   * disabled provider, so a suite that leaned on it could only ever assert the
   * refusal paths. `POST /redemptions` returning 201 is the assertion that
   * matters, and it needs something to succeed against.
   */
  let fixtureRedemptionAssetId = '';
  let fixtureRedemptionProviderSlug = '';
  let fixtureRedemptionRuleId = '';
  let fixtureRedemptionChainId = '';
  let fixtureRedemptionIssuerId = '';
  /** The account whose jurisdiction permits redemption, and its session. */
  let fixtureRedeemerId = '';
  let fixtureRedeemerToken = '';
  let fixtureRedemptionId = '';
  const fixtureRedemptionIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    // The version prefix is configured here, not only in main.ts. This suite
    // never runs main.ts, so wiring it in one place only would mean the tests
    // that exist to prove the wire format were asserting against a different
    // API than the one that ships.
    applyApiVersioning(app);
    await app.init();
    prisma = app.get(PrismaService);

    // Authenticate as the seeded admin so the endpoints behind auth are
    // covered. Configurable because CI seeds its own throwaway account —
    // hardcoding local credentials here would fail the moment the CI seed
    // differs, which is exactly the kind of drift this suite exists to catch.
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
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

    await seedTransactionFixtures(actor.id);
    await seedRedemptionFixtures();
  }

  /**
   * A wallet of this suite's own, an asset that lives on the same chain, and
   * two transactions in distinct states.
   *
   * The wallet is reassigned to the admin on every run: `POST /transactions`
   * takes its owner from the wallet, so a fixture left owned by a previous
   * run's account would be a 404 rather than a contract failure.
   */
  async function seedTransactionFixtures(adminId: string) {
    const chain = await prisma.chain.findFirst({ where: { enabled: true, family: 'evm' } });
    if (!chain) throw new Error('The contract suite needs an enabled EVM chain.');
    const asset = await prisma.asset.findFirst({
      where: { chainId: chain.id, enabled: true, transferSupported: true },
    });
    if (!asset) {
      throw new Error(`The contract suite needs a transferable asset on chain ${chain.id}.`);
    }

    const wallet = await prisma.wallet.upsert({
      where: { chainId_address: { chainId: chain.id, address: FIXTURE_WALLET_ADDRESS } },
      update: { userId: adminId },
      create: {
        userId: adminId,
        chainId: chain.id,
        address: FIXTURE_WALLET_ADDRESS,
        kind: 'smart',
        label: 'contract-spec fixture',
      },
    });
    fixtureWalletId = wallet.id;
    fixtureAssetRef = asset.assetId;

    // Oldest first, and a second apart, so the keyset ordering is a real
    // ordering rather than a tie-break on id.
    const base = Date.now() - 120_000;
    const states = ['created', 'pending'] as const;
    for (const [i, state] of states.entries()) {
      const createdAt = new Date(base + i * 1000);
      const row = await prisma.transaction.create({
        data: {
          userId: adminId,
          walletId: wallet.id,
          assetId: asset.id,
          chainId: chain.id,
          direction: 'out',
          state,
          amountRaw: '100000000',
          destination: FIXTURE_DESTINATION,
          txHash: state === 'created' ? null : `0x${String(i + 1).repeat(64)}`,
          confirmations: state === 'pending' ? 3 : 0,
          requiredConfirmations: 12,
          createdAt,
          expiresAt: new Date(createdAt.getTime() + 900_000),
        },
      });
      fixtureTxIds.push(row.id);
    }
    if (fixtureTxIds.length !== states.length) {
      throw new Error(`Expected ${states.length} transaction fixtures, created ${fixtureTxIds.length}.`);
    }
  }

  /**
   * A redeemable asset, an active metals provider, a jurisdiction that permits
   * redemption, and an account that lives in it.
   *
   * The jurisdiction comes from the account record — `POST /redemptions` takes
   * no country from the client — so the account is the fixture, not a request
   * parameter. `ZZ` is not a real ISO code, so this can never be mistaken for
   * a legal position or collide with a rule someone meant.
   */
  async function seedRedemptionFixtures() {
    const chain = await prisma.chain.create({
      data: {
        id: `contractspec-rx-${process.pid}`,
        name: 'Contract spec redemption chain',
        family: 'evm',
        nativeSymbol: 'ETH',
        enabled: true,
      },
    });
    fixtureRedemptionChainId = chain.id;

    const issuer = await prisma.issuer.create({
      data: {
        slug: `contract-spec-rx-${process.pid}`,
        name: 'Contract spec redemption issuer',
        jurisdiction: 'ZZ',
      },
    });
    fixtureRedemptionIssuerId = issuer.id;

    const asset = await prisma.asset.create({
      data: {
        assetId: `contractspec:${process.pid}:gold`,
        chainId: chain.id,
        contractAddress: `0x${'cd'.repeat(20)}`,
        symbol: 'CSXG',
        name: 'Contract spec gold',
        decimals: 18,
        category: 'metal',
        issuerId: issuer.id,
        custodyModel: 'allocated',
        redeemSupported: true,
        enabled: true,
      },
    });
    fixtureRedemptionAssetId = asset.assetId;

    const provider = await prisma.provider.create({
      data: {
        slug: `contract-spec-rx-${process.pid}`,
        name: 'Contract spec redemption provider',
        category: 'metals',
        status: 'active',
        capabilities: ['redeem'],
      },
    });
    fixtureRedemptionProviderSlug = provider.slug;

    const rule = await prisma.jurisdictionRule.create({
      data: {
        country: 'ZZ',
        region: '',
        canUseMetals: true,
        canRedeem: true,
        kycRequired: false,
        notes: 'Created by contracts.spec.ts. Not a legal position.',
      },
    });
    fixtureRedemptionRuleId = rule.id;

    // A dedicated account rather than the seeded admin. Jurisdiction is read
    // off the account record, so covering this route means putting an account
    // in the permitted jurisdiction — and rewriting an operator's real profile
    // to do it would be the sort of side effect that only shows up later.
    const email = `contract-rx-${process.pid}@correnthian.test`;
    await prisma.user.deleteMany({ where: { email } });
    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'correct-horse-battery-staple' });
    if (reg.status !== 201) {
      throw new Error(`could not create the redemption fixture account: ${reg.status}`);
    }
    const admin = await prisma.user.findUnique({ where: { email } });
    if (!admin) throw new Error('The redemption fixture account was not created.');
    fixtureRedeemerId = admin.id;
    // `@Roles('compliance')` guards the transition route; the account must be
    // able to take the same path the console's compliance operator would.
    await prisma.user.update({
      where: { id: admin.id },
      data: { country: 'ZZ', region: '', role: 'compliance' },
    });
    fixtureRedeemerToken = reg.body.token as string;
  }

  afterAll(async () => {
    // Fixture teardown. Deleting the audit probe is not a hole in the
    // append-only guarantee — that property is about the application's write
    // path, and this row is one the test created minutes ago. Leaving it
    // behind would put `contract.spec.probe` in an operator's audit view.
    if (fixtureAuditId) await prisma.auditLog.deleteMany({ where: { id: fixtureAuditId } });

    // The audit rows this suite caused, found by the request id the API
    // echoed back. Deleting by request is the only way to catch the ones the
    // global interceptor wrote, which carry a controller name rather than a
    // target this suite can name.
    if (requestIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { requestId: { in: requestIds } } });
    }
    // By wallet rather than by the ids this run remembered. A run that died
    // half way through never recorded what it created, and a suite that only
    // cleans up when it passes is a suite that leaves debris in an operator's
    // table every time it fails.
    if (fixtureWalletId) {
      await prisma.transaction.deleteMany({ where: { walletId: fixtureWalletId } });
      await prisma.wallet.deleteMany({ where: { id: fixtureWalletId } });
    }
    if (fixtureQuoteIds.length > 0) {
      await prisma.swapQuote.deleteMany({ where: { id: { in: fixtureQuoteIds } } });
    }
    // Redemptions before the asset they point at, and the fixture account
    // before the rows attributed to it.
    await prisma.redemptionRequest.deleteMany({
      where: {
        OR: [
          { id: { in: fixtureRedemptionIds } },
          ...(fixtureRedemptionAssetId ? [{ assetId: fixtureRedemptionAssetId }] : []),
          ...(fixtureRedeemerId ? [{ userId: fixtureRedeemerId }] : []),
        ],
      },
    });
    if (fixtureRedemptionId) {
      await prisma.redemptionRequest.deleteMany({ where: { id: fixtureRedemptionId } });
    }
    if (fixtureRedeemerId) {
      await prisma.auditLog.deleteMany({ where: { actorId: fixtureRedeemerId } });
      await prisma.session.deleteMany({ where: { userId: fixtureRedeemerId } });
      await prisma.user.deleteMany({ where: { id: fixtureRedeemerId } });
    }
    if (fixtureRedemptionAssetId) {
      await prisma.asset.deleteMany({ where: { assetId: fixtureRedemptionAssetId } });
    }
    if (fixtureRedemptionProviderSlug) {
      await prisma.provider.deleteMany({ where: { slug: fixtureRedemptionProviderSlug } });
    }
    if (fixtureRedemptionRuleId) {
      await prisma.jurisdictionRule.deleteMany({ where: { id: fixtureRedemptionRuleId } });
    }
    if (fixtureRedemptionIssuerId) {
      await prisma.issuer.deleteMany({ where: { id: fixtureRedemptionIssuerId } });
    }
    if (fixtureRedemptionChainId) {
      await prisma.chain.deleteMany({ where: { id: fixtureRedemptionChainId } });
    }
    await app?.close();
  });

  const get = (path: string) =>
    request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${token}`);

  type QuoteList = Contract<'GET /api/v1/swaps/quotes'>;
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
      const res = await get(`/api/v1/swaps/quotes?${qs.toString()}`);
      expect(res.status, `page ${page} returned ${res.status}`).toBe(200);
      const parsed = CONTRACT_REGISTRY['GET /api/v1/swaps/quotes'].parse(res.body);
      const first = parsed.items.at(0);
      if (!first) return { rows: seen, exhausted: true };
      seen.push(first);
      cursor = parsed.nextCursor;
      if (!cursor) return { rows: seen, exhausted: true };
    }
    return { rows: seen, exhausted: false };
  }

  const ENDPOINTS: Array<[keyof typeof CONTRACT_REGISTRY, string]> = [
    ['GET /api/v1/assets', '/api/v1/assets'],
    ['GET /api/v1/assets/stats', '/api/v1/assets/stats'],
    ['GET /api/v1/users', '/api/v1/users'],
    ['GET /api/v1/users/stats', '/api/v1/users/stats'],
    ['GET /api/v1/devices/all', '/api/v1/devices/all'],
    ['GET /api/v1/devices/stats', '/api/v1/devices/stats'],
    ['GET /api/v1/issuers', '/api/v1/issuers'],
    ['GET /api/v1/chains', '/api/v1/chains'],
    ['GET /api/v1/providers', '/api/v1/providers'],
    ['GET /api/v1/swaps/quotes/stats', '/api/v1/swaps/quotes/stats'],
    ['GET /api/v1/swaps/quotes', '/api/v1/swaps/quotes'],
    ['GET /api/v1/audit', '/api/v1/audit'],
    ['GET /api/v1/transactions', '/api/v1/transactions'],
    ['GET /api/v1/transactions/stats', '/api/v1/transactions/stats'],
    ['GET /api/v1/transactions/mine', '/api/v1/transactions/mine'],
    ['GET /api/v1/redemptions/stats', '/api/v1/redemptions/stats'],
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
      .get('/api/v1/users').set('Authorization', `Bearer ${token}`);
    const id = list.body?.items?.[0]?.id;
    if (!id) return; // no seeded user to check

    const res = await request(app.getHttpServer())
      .get(`/api/v1/users/${id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const parsed = CONTRACT_REGISTRY['GET /api/v1/users/:id'].safeParse(res.body);
    expect(parsed.success, JSON.stringify(parsed.error?.issues ?? [], null, 2)).toBe(true);
  });

  it('every failure uses the shared error envelope', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/users/not-a-real-id')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body).toHaveProperty('error.code');
    expect(res.body).toHaveProperty('error.message');
    expect(res.body).toHaveProperty('timestamp');
  });

  // --- redemptions ---------------------------------------------------------

  const redeem = (body: Record<string, unknown> = {}) =>
    request(app.getHttpServer())
      .post('/api/v1/redemptions')
      .set('Authorization', `Bearer ${fixtureRedeemerToken}`)
      .send({
        assetId: fixtureRedemptionAssetId,
        amountRaw: '1.5',
        providerSlug: fixtureRedemptionProviderSlug,
        ...body,
      });

  it('POST /api/v1/redemptions matches its contract', async () => {
    const res = await redeem();
    expect(res.status, `${res.status}: ${JSON.stringify(res.body)}`).toBe(201);

    const parsed = CONTRACT_REGISTRY['POST /api/v1/redemptions'].safeParse(res.body);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('\n');
      throw new Error(`POST /api/v1/redemptions does not match its contract:\n${detail}`);
    }
    expect(parsed.data.state).toBe('requested');
    fixtureRedemptionIds.push(parsed.data.id);
  });

  it('PATCH /api/v1/redemptions/:id/transition matches its contract', async () => {
    // This is the route that wrote to a column the table did not have. A
    // contract parse cannot see a missing column, but the 200 below cannot
    // happen unless the write committed — Prisma rejects the unknown argument
    // before it ever reaches Postgres.
    const created = await redeem();
    expect(created.status, `${created.status}: ${JSON.stringify(created.body)}`).toBe(201);
    fixtureRedemptionIds.push(created.body.id as string);

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/redemptions/${created.body.id}/transition`)
      .set('Authorization', `Bearer ${fixtureRedeemerToken}`)
      .send({ state: 'approved' });
    expect(res.status, `${res.status}: ${JSON.stringify(res.body)}`).toBe(200);

    const parsed = CONTRACT_REGISTRY['PATCH /api/v1/redemptions/:id/transition'].safeParse(res.body);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('\n');
      throw new Error(`PATCH /api/v1/redemptions/:id/transition does not match its contract:\n${detail}`);
    }
    // Who approved it is on the row, not only in the audit line.
    expect(parsed.data.state).toBe('approved');
    expect(parsed.data.reviewedBy).toBe(fixtureRedeemerId);
    fixtureRedemptionId = parsed.data.id;
  });

  it('GET /api/v1/redemptions/mine matches its contract', async () => {
    const created = await redeem();
    expect(created.status).toBe(201);
    fixtureRedemptionIds.push(created.body.id as string);

    // As the account that made it. `mine` is scoped to the session, so the
    // seeded admin would see an empty list and the assertion below would be
    // checking nothing.
    const res = await request(app.getHttpServer())
      .get('/api/v1/redemptions/mine')
      .set('Authorization', `Bearer ${fixtureRedeemerToken}`);
    expect(res.status, `${res.status}: ${JSON.stringify(res.body)}`).toBe(200);

    const parsed = CONTRACT_REGISTRY['GET /api/v1/redemptions/mine'].safeParse(res.body);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('\n');
      throw new Error(`GET /api/v1/redemptions/mine does not match its contract:\n${detail}`);
    }
    // Non-vacuous: an empty list would parse perfectly and prove nothing.
    expect(parsed.data.length).toBeGreaterThan(0);
    expect(parsed.data.some((r) => r.id === created.body.id)).toBe(true);
    expect(parsed.data.every((r) => r.asset.symbol.length > 0)).toBe(true);
  });

  // --- versioning -----------------------------------------------------------

  it('GET /api/v1/meta/versions matches its contract', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/meta/versions');
    expect(res.status, `${res.status}: ${JSON.stringify(res.body)}`).toBe(200);

    const parsed = CONTRACT_REGISTRY['GET /api/v1/meta/versions'].safeParse(res.body);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('\n');
      throw new Error(`/api/v1/meta/versions does not match its contract:\n${detail}`);
    }
    // The document has to describe this deployment, not a plausible one: a
    // registry that does not list the version actually serving traffic is
    // worse than no registry, because it is believed.
    expect(parsed.data.currentVersion).toBe('v1');
    expect(parsed.data.versionedPrefix).toBe('/api/v1');
    expect(parsed.data.versions.map((v) => v.id)).toContain('v1');
    expect(parsed.data.versions.find((v) => v.id === 'v1')?.status).toBe('current');
    expect(parsed.data.unversionedPaths).toContain('health');
  });

  it('an unknown version is a distinguishable 404, not a missing resource', async () => {
    const res = await request(app.getHttpServer()).get('/api/v2/assets');

    expect(res.status).toBe(404);
    const parsed = CONTRACT_REGISTRY['ERROR GET /api/v2/*'].safeParse(res.body);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('\n');
      throw new Error(`the v2 404 does not match its contract:\n${detail}`);
    }

    // The whole point: it says "wrong version", not "no such asset". A caller
    // who gets this must go and fix the URL they built.
    expect(parsed.data.error.code).toBe('unsupported_api_version');
    const detail = parsed.data.error.detail as { supportedVersions: string[]; requestedVersion: string };
    expect(detail.requestedVersion).toBe('v2');
    expect(detail.supportedVersions).toContain('v1');

    // And it is genuinely different from the other 404 this API produces.
    const missing = await request(app.getHttpServer())
      .get('/api/v1/assets/definitely-not-a-real-asset-id')
      .set('Authorization', `Bearer ${token}`);
    expect(missing.status).toBe(404);
    expect(missing.body).toHaveProperty('error.code', 'not_found');
    expect(missing.body.error.code).not.toBe('unsupported_api_version');
  });

  it('a versionless /api path is told which versions exist', async () => {
    const res = await request(app.getHttpServer()).get('/api/assets');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error.code', 'api_version_required');
    expect(res.body.error.detail.supportedVersions).toContain('v1');
  });

  it('an unknown route inside a served version names the versions', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/no-such-route');
    expect(res.status).toBe(404);

    const parsed = CONTRACT_REGISTRY['ERROR GET /api/v1/does-not-exist'].safeParse(res.body);
    expect(parsed.success, JSON.stringify(parsed.error?.issues ?? [], null, 2)).toBe(true);
    expect(res.body.error.code).toBe('not_found');
    expect(res.body.error.detail.versionedPrefix).toBe('/api/v1');
    expect(res.body.error.detail.supportedVersions).toContain('v1');
  });

  it('/health stays unversioned, because an orchestrator must not negotiate', async () => {
    const unversioned = await request(app.getHttpServer()).get('/health/live');
    expect(unversioned.status).toBe(200);
    expect(unversioned.body).toHaveProperty('status', 'ok');
    // Says what it is rather than implying membership of a version.
    expect(unversioned.headers['x-api-version']).toBe('unversioned');

    // The prefix does not shadow it into a second, versioned address.
    const versioned = await request(app.getHttpServer()).get('/api/v1/health/live');
    expect(versioned.status).toBe(404);
  });

  it('the transitional unversioned alias works and announces its own removal', async () => {
    const res = await request(app.getHttpServer())
      .get('/assets')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status, `${res.status}: ${JSON.stringify(res.body)}`).toBe(200);
    expect(CONTRACT_REGISTRY['GET /api/v1/assets'].safeParse(res.body).success).toBe(true);
    expect(res.headers['x-api-version']).toBe('v1');

    // Loud, standard, and machine-readable. A client still on the old address
    // has to be able to find out before it is cut off, not after.
    expect(res.headers['deprecation']).toBe('true');
    expect(res.headers['x-api-deprecated']).toBe('v1');
    expect(res.headers['sunset']).toBeTruthy();
    // A `Link` a client can actually follow. `</api/v1>` is a header that
    // looks right in a log and resolves to nothing.
    expect(res.headers['link']).toMatch(/^<\/api\/v1>;\s*rel="successor-version"$/);
    expect(res.headers['warning']).toContain('299');
  });

  it('a versioned response names its version', async () => {
    const res = await get('/api/v1/chains');
    expect(res.status).toBe(200);
    expect(res.headers['x-api-version']).toBe('v1');
  });

  // --- quotes ---------------------------------------------------------------

  it('GET /swaps/quotes resolves asset symbols and the provider server-side', async () => {
    const res = await get('/api/v1/swaps/quotes?limit=100');
    expect(res.status).toBe(200);

    const parsed = CONTRACT_REGISTRY['GET /api/v1/swaps/quotes'].parse(res.body);
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
    const byState = await get('/api/v1/swaps/quotes?state=broadcast&limit=100');
    expect(byState.status).toBe(200);
    const broadcast = CONTRACT_REGISTRY['GET /api/v1/swaps/quotes'].parse(byState.body).items;
    expect(broadcast.length).toBeGreaterThan(0);
    expect(broadcast.every((q) => q.state === 'broadcast')).toBe(true);
    // A route that ignored `state` would return the other two fixtures here.
    expect(broadcast.map((q) => q.id)).toEqual(expect.arrayContaining([fxBroadcast, fxDex]));
    expect(broadcast.map((q) => q.id)).not.toContain(fxQuoted);

    const byRail = await get('/api/v1/swaps/quotes?railKind=dex&limit=100');
    expect(byRail.status).toBe(200);
    const dex = CONTRACT_REGISTRY['GET /api/v1/swaps/quotes'].parse(byRail.body).items;
    expect(dex.length).toBeGreaterThan(0);
    expect(dex.every((q) => q.railKind === 'dex')).toBe(true);
    expect(dex.map((q) => q.id)).toContain(fxDex);

    const both = await get('/api/v1/swaps/quotes?state=quoted&railKind=dex&limit=100');
    expect(both.status).toBe(200);
    const narrowed = CONTRACT_REGISTRY['GET /api/v1/swaps/quotes'].parse(both.body).items;
    expect(narrowed.every((q) => q.state === 'quoted' && q.railKind === 'dex')).toBe(true);
    expect(narrowed.map((q) => q.id)).not.toContain(fxQuoted);
  });

  it('GET /swaps/quotes caps the page size', async () => {
    const res = await get('/api/v1/swaps/quotes?limit=101');
    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty('error.code', 'validation_failed');
  });

  it('GET /swaps/quotes rejects a cursor it cannot read', async () => {
    const res = await get('/api/v1/swaps/quotes?cursor=not-a-real-cursor');
    // Restarting at page one would hide a client bug behind a page that looks
    // correct, so an unreadable cursor is an error and not a default.
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error.code', 'bad_request');
  });

  it('GET /swaps/quotes paginates by keyset without repeating or skipping a row', async () => {
    const first = await get('/api/v1/swaps/quotes?limit=1');
    expect(first.status).toBe(200);
    const firstPage = CONTRACT_REGISTRY['GET /api/v1/swaps/quotes'].parse(first.body);
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

    const parsed = CONTRACT_REGISTRY['GET /api/v1/swaps/quotes/:id'].safeParse(res.body);
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

    const rows = CONTRACT_REGISTRY['GET /api/v1/audit'].parse(res.body);
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

    const rows = CONTRACT_REGISTRY['GET /api/v1/audit'].parse(res.body);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.outcome === 'denied')).toBe(true);
    expect(rows.map((r) => r.id)).toContain(fixtureAuditId);
  });

  it('GET /audit/:id matches its contract and returns the redacted metadata', async () => {
    const res = await get(`/api/v1/audit/${fixtureAuditId}`);
    expect(res.status, `${res.status}: ${JSON.stringify(res.body)}`).toBe(200);

    const parsed = CONTRACT_REGISTRY['GET /api/v1/audit/:id'].safeParse(res.body);
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

  // --- transactions ---------------------------------------------------------

  /**
   * A mutating request that this suite will look for in the trail.
   *
   * The `X-Request-Id` the API echoes back is the only handle on the audit
   * rows a request caused, which is the reason the header exists.
   */
  async function mutate(path: string, body: unknown) {
    const res = await request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .send(body as object);
    const requestId = res.headers['x-request-id'];
    if (typeof requestId === 'string') requestIds.push(requestId);
    return { res, requestId };
  }

  it('POST /transactions records an intent, and starts in `created`', async () => {
    const { res } = await mutate('/transactions', {
      walletId: fixtureWalletId,
      assetId: fixtureAssetRef,
      direction: 'out',
      amountRaw: '25000000',
      destination: FIXTURE_DESTINATION,
    });

    expect(res.status, `${res.status}: ${JSON.stringify(res.body)}`).toBe(201);
    expect(res.body.state).toBe('created');
    // Nothing has been signed and nothing exists on the network.
    expect(res.body.txHash).toBeNull();
    expect(res.body.signedAt).toBeNull();
    expect(res.body.broadcastAt).toBeNull();
  });

  it('POST /transactions/:id/transitions refuses a transition that skips a control', async () => {
    const { res } = await mutate(`/transactions/${fixtureTxIds[0]}/transitions`, {
      to: 'broadcast',
      txHash: `0x${'a'.repeat(64)}`,
    });

    // 400, not 200-with-a-flag: an out-of-order update means two operators
    // disagree about what happened, and that is not a success.
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('bad_request');
    expect(res.body.error.message).toMatch(/from "created" to "broadcast"/);

    // And the row did not move.
    const after = await get(`/transactions/${fixtureTxIds[0]}`);
    expect(after.body.state).toBe('created');
  });

  it('correlates the whole request through one request id, in the response and the trail', async () => {
    const { res, requestId } = await mutate(`/transactions/${fixtureTxIds[0]}/transitions`, {
      to: 'confirmed',
    });
    expect(res.status).toBe(400);
    expect(requestId, 'the API must echo the request id it recorded against').toBeTruthy();

    const audit = await get(`/audit?requestId=${requestId}`);
    expect(audit.status).toBe(200);
    const rows = CONTRACT_REGISTRY['GET /api/v1/audit'].parse(audit.body);

    // The global interceptor's line and the domain module's line, both under
    // the same id — which is what makes a support ticket actionable.
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.every((r) => r.requestId === requestId)).toBe(true);

    const refused = rows.find((r) => r.action === 'transaction.transition.rejected.confirmed');
    expect(refused, 'the refusal must be in the trail').toBeDefined();

    // §55's before/after, on a real state-change attempt.
    const detail = await get(`/audit/${refused?.id}`);
    expect(detail.status).toBe(200);
    const parsed = CONTRACT_REGISTRY['GET /api/v1/audit/:id'].parse(detail.body);
    expect(parsed.before).toEqual({ state: 'created' });
    expect(parsed.after).toEqual({ state: 'confirmed' });
    expect(parsed.outcome).toBe('failure');
  });

  it('POST /transactions/:id/transitions advances a legal edge and reports the new state', async () => {
    const { res } = await mutate(`/transactions/${fixtureTxIds[0]}/transitions`, { to: 'signed' });
    expect(res.status, `${res.status}: ${JSON.stringify(res.body)}`).toBe(201);
    expect(res.body.state).toBe('signed');
    expect(res.body.signedAt).not.toBeNull();
  });

  it('GET /transactions resolves every relation the console would otherwise join', async () => {
    const res = await get(`/transactions?walletId=${fixtureWalletId}&limit=100`);
    expect(res.status).toBe(200);

    const parsed = CONTRACT_REGISTRY['GET /api/v1/transactions'].parse(res.body);
    expect(parsed.items.length).toBeGreaterThanOrEqual(fixtureTxIds.length);

    for (const row of parsed.items) {
      expect(row.asset.symbol).not.toBe('');
      expect(row.chain.name).not.toBe('');
      expect(row.user.email).not.toBe('');
      expect(row.wallet.address).toBe(FIXTURE_WALLET_ADDRESS);
      // The console offers a button per edge; the edges come from the table,
      // not from a second copy of it in the client.
      expect(row.permittedNext.length).toBeGreaterThan(0);
    }

    // The `pending` fixture reports the depth it is waiting on.
    const pending = parsed.items.find((r) => r.id === fixtureTxIds[1]);
    expect(pending?.state).toBe('pending');
    expect(pending?.requiredConfirmations).toBe(12);
    expect(pending?.confirmations).toBe(3);
  });

  it('GET /transactions filters by state, and the filter is applied', async () => {
    const res = await get(`/transactions?walletId=${fixtureWalletId}&state=signed&limit=100`);
    expect(res.status).toBe(200);
    const rows = CONTRACT_REGISTRY['GET /api/v1/transactions'].parse(res.body).items;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.state === 'signed')).toBe(true);
    expect(rows.map((r) => r.id)).toContain(fixtureTxIds[0]);
    expect(rows.map((r) => r.id)).not.toContain(fixtureTxIds[1]);
  });

  it('GET /transactions paginates by keyset without repeating a row', async () => {
    const first = await get(`/transactions?walletId=${fixtureWalletId}&limit=1`);
    const page = CONTRACT_REGISTRY['GET /api/v1/transactions'].parse(first.body);
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeTruthy();

    const second = await get(
      `/transactions?walletId=${fixtureWalletId}&limit=1&cursor=${page.nextCursor}`,
    );
    expect(second.status).toBe(200);
    const next = CONTRACT_REGISTRY['GET /api/v1/transactions'].parse(second.body);
    expect(next.items[0]?.id).not.toBe(page.items[0]?.id);
  });

  it('GET /transactions/:id matches its contract and adds the chain data the list withholds', async () => {
    const res = await get(`/transactions/${fixtureTxIds[0]}`);
    expect(res.status, `${res.status}: ${JSON.stringify(res.body)}`).toBe(200);

    const parsed = CONTRACT_REGISTRY['GET /api/v1/transactions/:id'].safeParse(res.body);
    if (!parsed.success) {
      const detail = parsed.error.issues.map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
      throw new Error(`/transactions/:id does not match its contract:\n${detail}`);
    }
    expect(parsed.data.id).toBe(fixtureTxIds[0]);
    // The list projection withholds it; the detail is where an investigation
    // reads it.
    expect(parsed.data).toHaveProperty('metadata');
    expect(parsed.data).not.toHaveProperty('signature');
  });

  it('POST /transactions/:id/observations is support-only and counts confirmations', async () => {
    // The fixture is `pending` at depth 3 of 12. Observing it below the
    // threshold must leave it where it is.
    const below = await mutate(`/transactions/${fixtureTxIds[1]}/observations`, {
      txHash: `0x${'2'.repeat(64)}`,
      confirmations: 11,
      outcome: 'seen',
    });
    expect(below.res.status, JSON.stringify(below.res.body)).toBe(201);
    expect(below.res.body.state).toBe('pending');

    const at = await mutate(`/transactions/${fixtureTxIds[1]}/observations`, {
      txHash: `0x${'2'.repeat(64)}`,
      confirmations: 12,
      outcome: 'seen',
    });
    expect(at.res.status, JSON.stringify(at.res.body)).toBe(201);
    expect(at.res.body.state).toBe('confirmed');
    expect(at.res.body.confirmedAt).not.toBeNull();
  });
});
