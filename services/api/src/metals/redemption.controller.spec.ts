import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CONTRACT_REGISTRY } from '@correnthian/contracts';
import { AppModule } from '../app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import { applyApiVersioning } from '../versioning/apply-versioning.js';

/**
 * `POST /redemptions`, through the controller, against the real database.
 *
 * Two defects lived in the gap this file now covers, and both were invisible to
 * everything else:
 *
 * 1. The controller passed `country: null, region: null` with a comment saying
 *    they were "resolved from the account record". Nothing resolved them, and
 *    `JurisdictionService` denies a missing country unconditionally — so every
 *    redemption ever requested returned 451 and the feature had never worked.
 *    The service tests called the service directly with a country already in
 *    hand, so the controller layer was never on any test's path.
 *
 * 2. `transition()` wrote `reviewedBy` to a column `RedemptionRequest` does not
 *    have. Prisma rejects the unknown argument at runtime, and `tsc` accepts it
 *    because Prisma's `XOR` input types defeat the excess-property check. Only
 *    a write that actually reaches Postgres can see this, which is why the
 *    approval case below round-trips the row rather than asserting on a mock.
 *
 * Requires the Docker stack: `pnpm db:up`.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);

/** Skips locally without a database; fails in CI without one. */
const CI = Boolean(process.env.CI);

describe.skipIf(!HAS_DB && !CI)('POST /redemptions through the controller', () => {
  it('is running rather than skipped', () => {
    if (CI && !HAS_DB) {
      throw new Error(
        'The redemption suite cannot skip in CI. It is the only cover for the ' +
          'controller layer, which is where two production defects were sitting.',
      );
    }
    expect(HAS_DB).toBe(CI ? true : HAS_DB);
  });

  let app: INestApplication;
  let prisma: PrismaService;

  /**
   * Two jurisdictions, both of this suite's own making.
   *
   * `ZZ` permits redemption. `YY` has no rule at all, which for this engine
   * means deny — an unmatched location is a refusal, not a permission by
   * omission. Two letters that are not real ISO codes, so a run of this suite
   * can never be mistaken for a legal position or collide with a real one.
   */
  const PERMITTED = 'ZY';  // suite-unique, so parallel files cannot collide on (country, region)
  const UNMATCHED = 'YY';

  const emails = {
    permitted: `redemption-permitted-${process.pid}@correnthian.test`,
    blocked: `redemption-blocked-${process.pid}@correnthian.test`,
  };
  const PASSWORD = 'correct-horse-battery-staple';

  let permittedToken = '';
  let blockedToken = '';
  let permittedUserId = '';

  let assetRef = '';
  let providerSlug = '';
  const createdIds = {
    chains: [] as string[],
    issuers: [] as string[],
    assets: [] as string[],
    providers: [] as string[],
    rules: [] as string[],
    redemptions: [] as string[],
    users: [] as string[],
  };

  async function boot(): Promise<INestApplication> {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const application = moduleRef.createNestApplication();
    applyApiVersioning(application);
    await application.init();
    return application;
  }

  async function register(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: PASSWORD });
    if (res.status !== 201) {
      throw new Error(`could not create ${email}: ${res.status} ${JSON.stringify(res.body)}`);
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error(`the account for ${email} was not created`);
    createdIds.users.push(user.id);
    return res.body.token as string;
  }

  beforeAll(async () => {
    app = await boot();
    prisma = app.get(PrismaService);

    // Everything a redemption needs, built here rather than assumed from the
    // development seed. The seed's provider is deliberately disabled and its
    // assets are deliberately not redeemable, so a suite that leaned on it
    // would only ever prove the refusal paths.
    const chain = await prisma.chain.create({
      data: {
        id: `redemptionspec-${process.pid}`,
        name: 'Redemption spec chain',
        family: 'evm',
        nativeSymbol: 'ETH',
        enabled: true,
      },
    });
    createdIds.chains.push(chain.id);

    const issuer = await prisma.issuer.create({
      data: {
        slug: `redemption-spec-${process.pid}`,
        name: 'Redemption spec issuer',
        jurisdiction: PERMITTED,
      },
    });
    createdIds.issuers.push(issuer.id);

    const asset = await prisma.asset.create({
      data: {
        assetId: `redemptionspec:${process.pid}:gold`,
        chainId: chain.id,
        contractAddress: `0x${'ab'.repeat(20)}`,
        symbol: 'RSPG',
        name: 'Redemption spec gold',
        decimals: 18,
        category: 'metal',
        issuerId: issuer.id,
        custodyModel: 'allocated',
        redeemSupported: true,
        swapSupported: false,
        enabled: true,
      },
    });
    createdIds.assets.push(asset.id);
    assetRef = asset.assetId;

    const provider = await prisma.provider.create({
      data: {
        slug: `redemption-spec-${process.pid}`,
        name: 'Redemption spec provider',
        category: 'metals',
        status: 'active',
        capabilities: ['redeem'],
      },
    });
    createdIds.providers.push(provider.id);
    providerSlug = provider.slug;

    // Redemption permitted, and only here.
    const rule = await prisma.jurisdictionRule.upsert({
      where: { country_region: { country: PERMITTED, region: '' } },
      create: {
          country: PERMITTED,
          region: '',
          canBuyCrypto: false,
          canSellCrypto: false,
          canUseMetals: true,
          canRedeem: true,
          kycRequired: false,
          notes: 'Created by redemption.controller.spec.ts. Not a legal position.',
      },
      update: {
          country: PERMITTED,
          region: '',
          canBuyCrypto: false,
          canSellCrypto: false,
          canUseMetals: true,
          canRedeem: true,
          kycRequired: false,
          notes: 'Created by redemption.controller.spec.ts. Not a legal position.',
      },
    });
    createdIds.rules.push(rule.id);

    permittedToken = await register(emails.permitted);
    blockedToken = await register(emails.blocked);

    const permittedUser = await prisma.user.findUnique({ where: { email: emails.permitted } });
    if (!permittedUser) throw new Error('the permitted account was not created');
    permittedUserId = permittedUser.id;

    await prisma.user.update({
      where: { id: permittedUserId },
      data: { country: PERMITTED, region: '' },
    });
    await prisma.user.update({
      where: { email: emails.blocked },
      data: { country: UNMATCHED, region: '' },
    });

    // The suite shares one identity's fixed rate-limit window with every other
    // suite on this database. Clearing it keeps the result about redemptions.
    const redis = app.get(RedisService).raw;
    const used = await redis.keys('correnthian:rate:*');
    if (used.length > 0) await redis.del(used);
  }, 120_000);

  afterAll(async () => {
    // Ordered so the foreign keys let go. Every list is written whether or not
    // the suite passed: a test that cleans up only on success leaves debris in
    // a shared development database on every failure.
    for (const id of createdIds.redemptions) {
      await prisma.redemptionRequest.deleteMany({ where: { id } });
    }
    await prisma.redemptionRequest.deleteMany({
      where: { assetId: { in: createdIds.assets } },
    });
    await prisma.auditLog.deleteMany({
      where: { actorId: { in: createdIds.users } },
    });
    await prisma.session.deleteMany({ where: { userId: { in: createdIds.users } } });
    await prisma.user.deleteMany({ where: { id: { in: createdIds.users } } });
    for (const id of createdIds.assets) await prisma.asset.deleteMany({ where: { id } });
    for (const id of createdIds.providers) await prisma.provider.deleteMany({ where: { id } });
    for (const id of createdIds.rules) await prisma.jurisdictionRule.deleteMany({ where: { id } });
    for (const id of createdIds.issuers) await prisma.issuer.deleteMany({ where: { id } });
    for (const id of createdIds.chains) await prisma.chain.deleteMany({ where: { id } });

    await app?.close();
  });

  const redeem = (token: string, body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/api/v1/redemptions')
      .set('Authorization', `Bearer ${token}`)
      .send({ assetId: assetRef, amountRaw: '1.5', providerSlug, ...body });

  // --- DEF-001: the request must actually be able to succeed ---------------

  it('creates a redemption in a permitted jurisdiction', async () => {
    const res = await redeem(permittedToken, {});
    expect(res.status, JSON.stringify(res.body)).toBe(201);

    const parsed = CONTRACT_REGISTRY['POST /api/v1/redemptions'].safeParse(res.body);
    expect(parsed.success, JSON.stringify(parsed.error ?? res.body)).toBe(true);

    // State is `requested` and nothing else: the service never auto-approves a
    // request for physical metal.
    expect(res.body.state).toBe('requested');
    expect(res.body.reviewedBy).toBeNull();

    const row = await prisma.redemptionRequest.findUnique({ where: { id: res.body.id } });
    expect(row, 'the created redemption must be readable back from Postgres').not.toBeNull();
    expect(row?.state).toBe('requested');
    expect(row?.userId).toBe(permittedUserId);
    createdIds.redemptions.push(res.body.id as string);
  });

  it('returns 451 for an account whose jurisdiction matches no rule', async () => {
    const res = await redeem(blockedToken, {});
    expect(res.status).toBe(451);
    expect(res.body.error?.code).toBe('jurisdiction_blocked');
  });

  it('ignores a jurisdiction the client claims in the request body', async () => {
    // The trust rule, stated as behaviour rather than as a comment. The
    // blocked account claims to be in the permitted jurisdiction and claims
    // the permitted account's identity; both must be ignored, because the
    // answer comes from the authenticated account's own record.
    const blockedUser = await prisma.user.findUnique({ where: { email: emails.blocked } });
    const before = await prisma.redemptionRequest.count({
      where: { userId: blockedUser?.id ?? '' },
    });

    const res = await redeem(blockedToken, {
      country: PERMITTED,
      region: '',
      userId: permittedUserId,
    });
    expect(res.status).toBe(451);
    expect(res.body.error?.code).toBe('jurisdiction_blocked');

    // And nothing was written. A refusal that still persisted a request would
    // be the worse of the two outcomes.
    const after = await prisma.redemptionRequest.count({
      where: { userId: blockedUser?.id ?? '' },
    });
    expect(after).toBe(before);
  });

  it('refuses an account with no jurisdiction on record rather than guessing', async () => {
    const email = `redemption-nojur-${process.pid}@correnthian.test`;
    const token = await register(email);
    const res = await redeem(token, {});
    expect(res.status).toBe(451);
    expect(res.body.error?.code).toBe('jurisdiction_blocked');
    expect(res.body.error?.detail?.reason).toBe('account_has_no_jurisdiction');
  });

  // --- DEF-002: the approved transition must reach Postgres ----------------

  it('round-trips the approved transition, including who approved it', async () => {
    const created = await redeem(permittedToken, {});
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    createdIds.redemptions.push(created.body.id as string);
    const id = created.body.id as string;

    // `@Roles('compliance')` on the transition route. Promoting the account
    // takes effect immediately: the session guard re-reads the user per request.
    await prisma.user.update({ where: { id: permittedUserId }, data: { role: 'compliance' } });

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/redemptions/${id}/transition`)
      .set('Authorization', `Bearer ${permittedToken}`)
      .send({ state: 'approved' });

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const parsed = CONTRACT_REGISTRY['PATCH /api/v1/redemptions/:id/transition'].safeParse(res.body);
    expect(parsed.success, JSON.stringify(parsed.error ?? res.body)).toBe(true);

    // The proof is the row, not the response: `reviewedBy` is a column this
    // table did not have when the write was written, and a write to a column
    // that does not exist is a 500 that never commits.
    const row = await prisma.redemptionRequest.findUnique({ where: { id } });
    expect(row, 'the approval must commit to Postgres').not.toBeNull();
    expect(row?.state).toBe('approved');
    expect(row?.reviewedBy).toBe(permittedUserId);
    expect(res.body.reviewedBy).toBe(permittedUserId);
  });

  it('refuses a transition that skips a control', async () => {
    const created = await redeem(permittedToken, {});
    expect(created.status).toBe(201);
    createdIds.redemptions.push(created.body.id as string);

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/redemptions/${created.body.id}/transition`)
      .set('Authorization', `Bearer ${permittedToken}`)
      .send({ state: 'delivered' });
    expect(res.status).toBe(400);
  });
});
