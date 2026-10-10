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

function decisionBody(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'evt_http_1',
    type: 'inquiry.passed',
    created_at: new Date().toISOString(),
    data: {
      id: 'inq_http_1',
      reference_id: '',
      status: 'passed',
      watchlist: 'clear',
      codes: ['pass'],
      ...over,
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
    const { raw, header } = signed(decisionBody({ reference_id: userId }));

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
    const { raw } = signed(decisionBody({ reference_id: userId }));

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
    const { raw, header } = signed(decisionBody({ reference_id: userId }));

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
      decisionBody({ reference_id: userId, id: 'inq_someone_elses' }),
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
