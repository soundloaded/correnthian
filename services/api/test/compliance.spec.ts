import 'dotenv/config';
import { createHmac } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { applyApiVersioning } from '../src/versioning/apply-versioning.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PERSONA_SIGNATURE_HEADER } from '../src/compliance/screening/persona-screening.provider.js';
import { FakeScreeningProvider } from '../src/compliance/screening/fake-screening.provider.js';
import { KycService } from '../src/compliance/kyc.service.js';
import { PersonaScreeningProvider } from '../src/compliance/screening/persona-screening.provider.js';
import { SCREENING_PROVIDER } from '../src/compliance/screening/screening-provider.js';

/**
 * The Persona webhook over HTTP — BE-1101 §2.
 *
 * The unit specs prove the adapter verifies and the service applies; this
 * proves the three are wired in that order — signature before parse, parse
 * before apply — against a booted app with a real HMAC. A controller that
 * parsed before verifying would pass every unit suite and accept forged
 * events, which is why the order is asserted here rather than read from
 * the source.
 *
 * The provider is overridden with a Persona adapter on a test secret (the
 * module would otherwise hand KycService the fake, which verifies nothing).
 * The secret lives in this file, not in any `.env*`: it signs nothing real.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const CI = Boolean(process.env.CI);
const SECRET = 'whsec_test_only_never_a_real_secret';

function signed(body: unknown, atSeconds = Math.floor(Date.now() / 1000)): { raw: string; header: string } {
  const raw = JSON.stringify(body);
  const sig = createHmac('sha256', SECRET).update(`${atSeconds}.${raw}`).digest('hex');
  return { raw, header: `t=${atSeconds},v1=${sig}` };
}

function decisionBody(opts: { inquiryId?: string; referenceId?: string } = {}): Record<string, unknown> {
  // JSON:API event envelope, per the retrieve-an-event example: the name
  // selects the mapping, payload.data carries the inquiry. The reference
  // rides in the inquiry attributes when present; when it is not, the
  // service binds by the inquiry id instead — both paths are exercised
  // below, because the reference's presence is the vendor's choice.
  const attributes: Record<string, unknown> = { status: 'approved' };
  if (opts.referenceId !== undefined) attributes['reference-id'] = opts.referenceId;
  return {
    data: {
      id: 'evt_http_1',
      type: 'event',
      attributes: {
        name: 'inquiry.approved',
        payload: {
          data: {
            type: 'inquiry',
            id: opts.inquiryId ?? 'inq_http_1',
            attributes,
            relationships: {},
          },
        },
        'created-at': new Date().toISOString(),
        context: {},
      },
    },
  };
}

describe.skipIf(!HAS_DB && !CI)('POST /compliance/webhooks/persona', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userId = '';

  beforeAll(async () => {
    process.env['RATE_LIMIT_MAX_REQUESTS'] = '100000';
    process.env['RATE_LIMIT_AUTH_MAX_REQUESTS'] = '100000';
    const redisBase = (process.env['REDIS_URL'] ?? 'redis://localhost:6380').replace(/\/\d+$/, '');
    process.env['REDIS_URL'] = `${redisBase}/11`;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SCREENING_PROVIDER)
      .useValue(
        new PersonaScreeningProvider(
          { apiKey: 'key_test', webhookSecret: SECRET, baseUrl: 'https://fake.test/api/v1' },
          (async () => { throw new Error('no HTTP from this suite'); }) as never,
        ),
      )
      .compile();
    // `rawBody: true` is what the webhook verifies the signature over. JSON
    // parsing consumes the stream, so without it the HMAC input is gone and
    // every signature fails — including valid ones.
    app = moduleRef.createNestApplication({ rawBody: true });
    applyApiVersioning(app);
    await app.init();
    prisma = app.get(PrismaService);

    const user = await prisma.user.create({
      data: {
        email: `webhook-spec-${Date.now()}@example.test`,
        passwordDigest: 'not-a-real-digest',
        role: 'user',
      },
    });
    userId = user.id;
    await prisma.kycProfile.create({
      data: { userId, status: 'pending', providerRef: 'inq_http_1', provider: 'persona' },
    });
  }, 90_000);

  afterAll(async () => {
    if (prisma && userId) {
      await prisma.kycProfile.deleteMany({ where: { userId } });
      await prisma.webhookEvent.deleteMany({ where: { provider: 'persona' } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await app?.close();
    delete process.env['RATE_LIMIT_MAX_REQUESTS'];
    delete process.env['RATE_LIMIT_AUTH_MAX_REQUESTS'];
    delete process.env['REDIS_URL'];
  });

  it('is running rather than skipped', () => {
    if (CI && !HAS_DB) throw new Error('Webhook coverage cannot skip in CI.');
    expect(userId).not.toBe('');
  });

  it('applies a signed decision for our inquiry', async () => {
    const { raw, header } = signed(decisionBody({ referenceId: userId }));

    const res = await request(app.getHttpServer())
      .post('/api/v1/compliance/webhooks/persona')
      .set(PERSONA_SIGNATURE_HEADER, header)
      .set('Content-Type', 'application/json')
      .send(raw);

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toMatchObject({ received: true, applied: true, status: 'approved' });

    const profile = await prisma.kycProfile.findUniqueOrThrow({ where: { userId } });
    expect(profile.status).toBe('approved');
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.kycStatus).toBe('approved');
  });

  it('answers 401 when the signature is forged, and touches no state', async () => {
    const { raw } = signed(decisionBody({ referenceId: userId }));

    const res = await request(app.getHttpServer())
      .post('/api/v1/compliance/webhooks/persona')
      .set(PERSONA_SIGNATURE_HEADER, 't=9999999999,v1=deadbeef')
      .set('Content-Type', 'application/json')
      .send(raw);

    expect(res.status).toBe(401);
    const events = await prisma.webhookEvent.count({ where: { provider: 'persona' } });
    expect(events).toBe(1);
  });

  it('acknowledges a replay without applying it twice', async () => {
    const { raw, header } = signed(decisionBody({ referenceId: userId }));

    const res = await request(app.getHttpServer())
      .post('/api/v1/compliance/webhooks/persona')
      .set(PERSONA_SIGNATURE_HEADER, header)
      .set('Content-Type', 'application/json')
      .send(raw);

    // Same event id as the first test: idempotent, not an error — Persona
    // retries deliveries, and a retry must not become a second decision.
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ received: true, applied: false });
  });

  it('does not retry-bait on a validly signed event for an unknown inquiry', async () => {
    const { raw, header } = signed(
      decisionBody({ referenceId: userId, inquiryId: 'inq_someone_elses' }),
    );

    const res = await request(app.getHttpServer())
      .post('/api/v1/compliance/webhooks/persona')
      .set(PERSONA_SIGNATURE_HEADER, header)
      .set('Content-Type', 'application/json')
      .send(raw);

    // 200, not 500: a 500 would make Persona retry an event that will never
    // apply, and would turn a bad actor's probe into a retry storm.
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ received: true, applied: false });
  });
});

describe.skipIf(!HAS_DB && !CI)('the compliance gate on redemption', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let assetRef = '';
  let providerSlug = '';
  let verifiedToken = '';
  let unverifiedToken = '';
  const created = { chains: [] as string[], issuers: [] as string[], assets: [] as string[], providers: [] as string[], rules: [] as string[], users: [] as string[] };
  // `QX` is not a real ISO code, so this can never be mistaken for a legal
  // position. Distinct from the `ZZ`/`ZY` fixtures of the other suites.
  const COUNTRY = 'QX';

  beforeAll(async () => {
    process.env['RATE_LIMIT_MAX_REQUESTS'] = '100000';
    process.env['RATE_LIMIT_AUTH_MAX_REQUESTS'] = '100000';
    const redisBase = (process.env['REDIS_URL'] ?? 'redis://localhost:6380').replace(/\/\d+$/, '');
    process.env['REDIS_URL'] = `${redisBase}/11`;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    applyApiVersioning(app);
    await app.init();
    prisma = app.get(PrismaService);

    const chain = await prisma.chain.create({
      data: {
        id: `kycspec-${process.pid}`,
        name: 'KYC spec chain',
        family: 'evm',
        nativeSymbol: 'ETH',
        enabled: true,
      },
    });
    created.chains.push(chain.id);
    const issuer = await prisma.issuer.create({
      data: { slug: `kyc-spec-${process.pid}`, name: 'KYC spec issuer', jurisdiction: COUNTRY },
    });
    created.issuers.push(issuer.id);
    const asset = await prisma.asset.create({
      data: {
        assetId: `kycspec:${process.pid}:gold`,
        chainId: chain.id,
        contractAddress: `0x${'ef'.repeat(20)}`,
        symbol: 'KXG',
        name: 'KYC spec gold',
        decimals: 18,
        category: 'metal',
        issuerId: issuer.id,
        custodyModel: 'allocated',
        redeemSupported: true,
        enabled: true,
      },
    });
    created.assets.push(asset.id);
    assetRef = asset.assetId;
    const provider = await prisma.provider.create({
      data: {
        slug: `kyc-spec-${process.pid}`,
        name: 'KYC spec provider',
        category: 'metals',
        status: 'active',
        capabilities: ['redeem'],
      },
    });
    created.providers.push(provider.id);
    providerSlug = provider.slug;
    const rule = await prisma.jurisdictionRule.upsert({
      where: { country_region: { country: COUNTRY, region: '' } },
      create: {
        country: COUNTRY, region: '', canBuyCrypto: false, canSellCrypto: false,
        canUseMetals: true, canRedeem: true, kycRequired: false,
        notes: 'Created by compliance.spec.ts. Not a legal position.',
      },
      update: {},
    });
    created.rules.push(rule.id);

    const mkUser = async (tag: string, verified: boolean) => {
      const email = `kyc-gate-${tag}-${process.pid}@example.test`;
      const reg = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password: 'correct-horse-battery-staple' });
      expect(reg.status).toBe(201);
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      created.users.push(user.id);
      await prisma.user.update({ where: { id: user.id }, data: { country: COUNTRY, region: '' } });
      if (verified) {
        await prisma.kycProfile.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id, status: 'approved', providerRef: `kyc-spec-${process.pid}`,
            provider: 'spec', sanctionsResult: 'clean', sanctionsScreenedAt: new Date(),
          },
          update: { status: 'approved', sanctionsResult: 'clean', sanctionsScreenedAt: new Date() },
        });
        await prisma.user.update({ where: { id: user.id }, data: { kycStatus: 'approved' } });
      }
      return reg.body.token as string;
    };
    verifiedToken = await mkUser('verified', true);
    unverifiedToken = await mkUser('unverified', false);
  }, 90_000);

  afterAll(async () => {
    if (prisma) {
      await prisma.redemptionRequest.deleteMany({ where: { assetId: { in: created.assets } } });
      await prisma.session.deleteMany({ where: { userId: { in: created.users } } });
      await prisma.user.deleteMany({ where: { id: { in: created.users } } });
      for (const id of created.assets) await prisma.asset.deleteMany({ where: { id } });
      for (const id of created.providers) await prisma.provider.deleteMany({ where: { id } });
      for (const id of created.rules) await prisma.jurisdictionRule.deleteMany({ where: { id } });
      for (const id of created.issuers) await prisma.issuer.deleteMany({ where: { id } });
      for (const id of created.chains) await prisma.chain.deleteMany({ where: { id } });
    }
    await app?.close();
    delete process.env['RATE_LIMIT_MAX_REQUESTS'];
    delete process.env['RATE_LIMIT_AUTH_MAX_REQUESTS'];
    delete process.env['REDIS_URL'];
  });

  const redeem = (token: string) =>
    request(app.getHttpServer())
      .post('/api/v1/redemptions')
      .set('Authorization', `Bearer ${token}`)
      .send({ assetId: assetRef, amountRaw: '10', providerSlug });

  it('lets a verified user with a fresh screen open a payout', async () => {
    const res = await redeem(verifiedToken);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.state).toBe('requested');
  });

  it('denies an unverified user with one generic 403 and creates nothing', async () => {
    const before = await prisma.redemptionRequest.count({ where: { assetId: { in: created.assets } } });
    const res = await redeem(unverifiedToken);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden');
    // Tipping-off: the denial must not say which check fired.
    expect(JSON.stringify(res.body)).not.toMatch(/sanction|kyc_required|kyc_pending|screening_unavailable/i);
    const after = await prisma.redemptionRequest.count({ where: { assetId: { in: created.assets } } });
    expect(after).toBe(before);
  });
});

describe.skipIf(!HAS_DB && !CI)('verification start and the review queue', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let screening: FakeScreeningProvider;
  let kyc: KycService;
  let userToken = '';
  let userId = '';
  let operatorToken = '';
  let operatorId = '';

  beforeAll(async () => {
    process.env['RATE_LIMIT_MAX_REQUESTS'] = '100000';
    process.env['RATE_LIMIT_AUTH_MAX_REQUESTS'] = '100000';
    const redisBase = (process.env['REDIS_URL'] ?? 'redis://localhost:6380').replace(/\/\d+$/, '');
    process.env['REDIS_URL'] = `${redisBase}/10`;

    screening = new FakeScreeningProvider();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SCREENING_PROVIDER)
      .useValue(screening)
      .compile();
    app = moduleRef.createNestApplication();
    applyApiVersioning(app);
    await app.init();
    prisma = app.get(PrismaService);
    kyc = app.get(KycService);

    const mkUser = async (tag: string, role: 'user' | 'compliance') => {
      const email = `kyc-review-${tag}-${process.pid}@example.test`;
      const reg = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password: 'correct-horse-battery-staple' });
      expect(reg.status).toBe(201);
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      if (role !== 'user') {
        await prisma.user.update({ where: { id: user.id }, data: { role } });
      }
      return { token: reg.body.token as string, id: user.id };
    };
    ({ token: userToken, id: userId } = await mkUser('user', 'user'));
    ({ token: operatorToken, id: operatorId } = await mkUser('operator', 'compliance'));

    screening.scriptCreate(userId, { inquiryId: `kyc-review-${process.pid}`, sessionToken: 'sess_review' });
  }, 90_000);

  afterAll(async () => {
    if (prisma) {
      const users = await prisma.user.findMany({
        where: { email: { startsWith: 'kyc-review-' } },
        select: { id: true },
      });
      const ids = users.map((u) => u.id);
      if (ids.length > 0) {
        await prisma.session.deleteMany({ where: { userId: { in: ids } } });
        await prisma.user.deleteMany({ where: { id: { in: ids } } });
      }
    }
    await app?.close();
    delete process.env['RATE_LIMIT_MAX_REQUESTS'];
    delete process.env['RATE_LIMIT_AUTH_MAX_REQUESTS'];
    delete process.env['REDIS_URL'];
  });

  it('opens verification for the caller and hands back the vendor session', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/compliance/verification/start')
      .set('Authorization', `Bearer ${userToken}`)
      .send({});

    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body).toMatchObject({
      status: 'pending',
      inquiryId: `kyc-review-${process.pid}`,
      sessionToken: 'sess_review',
    });
  });

  it('lists parked profiles to an operator, and refuses a customer', async () => {
    // Park the user through the service: the webhook path is covered in
    // the first block, and the point here is what the queue shows.
    await kyc.applyWebhookEvent({
      eventId: `evt_park_http_${process.pid}`,
      inquiryId: `kyc-review-${process.pid}`,
      referenceId: userId,
      occurredAt: new Date(),
      decision: { verdict: 'needs_review', watchlist: 'clean', codes: [], occurredAt: new Date() },
    });

    const asOperator = await request(app.getHttpServer())
      .get('/api/v1/compliance/reviews')
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(asOperator.status, JSON.stringify(asOperator.body)).toBe(200);
    const row = (asOperator.body as Array<Record<string, unknown>>).find((r) => r['userId'] === userId);
    expect(row).toMatchObject({ status: 'pending' });
    expect(row?.['email']).toContain('kyc-review-user-');

    const asCustomer = await request(app.getHttpServer())
      .get('/api/v1/compliance/reviews')
      .set('Authorization', `Bearer ${userToken}`);
    expect(asCustomer.status).toBe(403);
  });

  it('an operator decision approves with a reason, and rejects without one', async () => {
    const good = await request(app.getHttpServer())
      .post(`/api/v1/compliance/reviews/${userId}/decide`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ decision: 'approve', reason: 'Documents verified against issuer records.' });
    expect(good.status, JSON.stringify(good.body)).toBe(201);
    expect(good.body).toMatchObject({ status: 'approved' });
    // The decision records *who*, not just what: a review queue that cannot
    // name its reviewer is an audit trail with the names redacted.
    const decided = await prisma.kycProfile.findUniqueOrThrow({ where: { userId } });
    expect(decided.reviewedBy).toBe(operatorId);

    // Park again for the refusal cases.
    await prisma.kycProfile.update({ where: { userId }, data: { needsReview: true, status: 'pending' } });

    // Two layers refuse an unexplained decision: the shape pipe rejects an
    // empty reason (422), and `assertReason` rejects a reason too short to
    // say anything (400). Both are asserted — a test that only sent ''
    // would never reach the service rule.
    const emptyReason = await request(app.getHttpServer())
      .post(`/api/v1/compliance/reviews/${userId}/decide`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ decision: 'approve', reason: '' });
    expect(emptyReason.status).toBe(422);

    const shortReason = await request(app.getHttpServer())
      .post(`/api/v1/compliance/reviews/${userId}/decide`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ decision: 'approve', reason: 'ok' });
    expect(shortReason.status).toBe(400);

    const customer = await request(app.getHttpServer())
      .post(`/api/v1/compliance/reviews/${userId}/decide`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ decision: 'approve', reason: 'Let me in, I insist at length.' });
    expect(customer.status).toBe(403);
  });
});
