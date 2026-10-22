import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { applyApiVersioning } from '../src/versioning/apply-versioning.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { SETTING_DEFINITIONS } from '../src/settings/registry.js';

/**
 * System settings over HTTP — BE-1507.
 *
 * Two tiers with nothing shared between them: any operator reads the list (the
 * console renders the settings page against it), only `admin` writes, and
 * every write carries a reason the audit trail keeps.
 *
 * The suite cleans up after itself in `afterAll`, and that is not tidiness:
 * an override left behind would change the behaviour of every later suite
 * that reads the same setting — a test that leaves the intent lifetime at 30
 * minutes would make the transactions suite fail for a reason that has
 * nothing to do with it.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const CI = Boolean(process.env.CI);

const KEY = 'transactions.intent-ttl-minutes';
const REASON = 'the suite proves a system setting needs a recorded reason';

describe.skipIf(!HAS_DB && !CI)('system settings enforce two tiers over HTTP', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userToken = '';
  let supportToken = '';
  let adminToken = '';

  const get = (path: string, auth: string) =>
    request(app.getHttpServer()).get(`/api/v1${path}`).set('Authorization', `Bearer ${auth}`);
  const patch = (path: string, body: unknown, auth: string) =>
    request(app.getHttpServer()).patch(`/api/v1${path}`).set('Authorization', `Bearer ${auth}`).send(body as object);
  const del = (path: string, body: unknown, auth: string) =>
    request(app.getHttpServer()).delete(`/api/v1${path}`).set('Authorization', `Bearer ${auth}`).send(body as object);

  beforeAll(async () => {
    process.env['RATE_LIMIT_MAX_REQUESTS'] = '100000';
    process.env['RATE_LIMIT_AUTH_MAX_REQUESTS'] = '100000';
    const redisBase = (process.env['REDIS_URL'] ?? 'redis://localhost:6380').replace(/\/\d+$/, '');
    process.env['REDIS_URL'] = `${redisBase}/0`;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    applyApiVersioning(app);
    await app.init();
    prisma = app.get(PrismaService);

    const mkUser = async (tag: string, role?: 'support' | 'admin') => {
      const email = `settings-${tag}-${process.pid}@example.test`;
      const reg = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password: 'correct-horse-battery-staple' });
      expect(reg.status).toBe(201);
      if (role) {
        const user = await prisma.user.findUniqueOrThrow({ where: { email } });
        await prisma.user.update({ where: { id: user.id }, data: { role } });
      }
      return reg.body.token as string;
    };
    userToken = await mkUser('user');
    supportToken = await mkUser('support', 'support');
    adminToken = await mkUser('admin', 'admin');
  }, 90_000);

  afterAll(async () => {
    // Leave nothing behind: an override is behaviour, not a fixture.
    await prisma?.systemSetting.deleteMany({ where: { key: KEY } });
    if (prisma) {
      const users = await prisma.user.findMany({
        where: { email: { startsWith: 'settings-' } },
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

  it('is running rather than skipped', () => {
    if (CI && !HAS_DB) throw new Error('System settings cannot skip in CI.');
    expect(adminToken).not.toBe('');
  });

  it('an operator reads the list; a customer does not', async () => {
    expect((await get('/settings/system', supportToken)).status).toBe(200);
    expect((await get('/settings/system', adminToken)).status).toBe(200);
    expect((await get('/settings/system', userToken)).status).toBe(403);
  });

  it('the list is the registry, not the table', async () => {
    const res = await get('/settings/system', supportToken);
    expect(res.status).toBe(200);
    const keys = res.body.map((entry: { key: string }) => entry.key);
    expect(keys).toEqual(SETTING_DEFINITIONS.map((definition) => definition.key));
    // A setting nobody has overridden is present, with its declared default
    // and a source that says so.
    const entry = res.body.find((e: { key: string }) => e.key === KEY);
    expect(entry).toMatchObject({ value: 15, source: 'default' });
  });

  it('writes are admin-only and need a reason', async () => {
    // Support reads what is in force but cannot change it.
    expect((await patch(`/settings/system/${KEY}`, { value: 30, reason: REASON }, supportToken)).status).toBe(403);
    expect((await patch(`/settings/system/${KEY}`, { value: 30, reason: REASON }, userToken)).status).toBe(403);
    // A reason shorter than the floor is a 400, not a write.
    expect((await patch(`/settings/system/${KEY}`, { value: 30, reason: 'short' }, adminToken)).status).toBe(400);

    const written = await patch(`/settings/system/${KEY}`, { value: 30, reason: REASON }, adminToken);
    expect(written.status, JSON.stringify(written.body)).toBe(200);
    expect(written.body).toMatchObject({ key: KEY, value: 30, source: 'override' });

    // And the list now serves the override, not the default.
    const list = await get('/settings/system', supportToken);
    const entry = list.body.find((e: { key: string }) => e.key === KEY);
    expect(entry).toMatchObject({ value: 30, source: 'override' });
  });

  it('a value the setting refuses is refused at the edge', async () => {
    // Out of range: 0 minutes would expire every intent the moment it was
    // created, so the bound is the point.
    expect((await patch(`/settings/system/${KEY}`, { value: 0, reason: REASON }, adminToken)).status).toBe(422);
    // The wrong shape entirely.
    expect((await patch(`/settings/system/${KEY}`, { value: { minutes: 30 }, reason: REASON }, adminToken)).status).toBe(422);
  });

  it('a key nobody declared is not a setting', async () => {
    expect((await patch('/settings/system/nope.not-a-key', { value: 1, reason: REASON }, adminToken)).status).toBe(404);
  });

  it('clearing an override puts the declared default back', async () => {
    const gone = await del(`/settings/system/${KEY}`, { reason: REASON }, adminToken);
    expect(gone.status).toBe(204);

    const list = await get('/settings/system', supportToken);
    const entry = list.body.find((e: { key: string }) => e.key === KEY);
    expect(entry).toMatchObject({ value: 15, source: 'default' });

    // Clearing again has nothing to clear, and says so rather than writing an
    // audit line about a change that did not happen.
    expect((await del(`/settings/system/${KEY}`, { reason: REASON }, adminToken)).status).toBe(404);
  });

  it('no row exists for a key the registry does not declare', async () => {
    // A row for a key nobody reads is a setting that looks live and is not —
    // the same shape of defect this feature exists to remove.
    const declared = new Set<string>(SETTING_DEFINITIONS.map((definition) => definition.key));
    const rows = await prisma.systemSetting.findMany({ select: { key: true } });
    const orphans = rows.map((row) => row.key).filter((key) => !declared.has(key));
    expect(orphans, `rows for undeclared keys: ${orphans.join(', ')}`).toEqual([]);
  });
});
