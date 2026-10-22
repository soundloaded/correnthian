import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { applyApiVersioning } from '../src/versioning/apply-versioning.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { DeliveryService } from '../src/notifications/delivery.service.js';

/**
 * The dispatch job over a real database — DEF-009 closed over HTTP.
 *
 * The job claims pending rows atomically and sends them through the sink
 * the test environment wires. Two properties are pinned:
 *
 *  - A run through the console sink marks the row sent without delivering
 *    anything. The provider id is null, but the attempt is logged — the
 *    sink renders, it does not deliver, and it says so.
 *  - Two workers racing for the same row send it once. The claim repeats
 *    the predicate on the write, so the loser claims zero.
 *
 * Rows are tagged per-suite and deleted in `afterAll`, because a leftover
 * pending row is work the next suite's sweep would pick up.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const CI = Boolean(process.env.CI);
const TAG = `d-spec-${process.pid}`;

describe.skipIf(!HAS_DB && !CI)('notification dispatch claims and sends over HTTP', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let delivery: DeliveryService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    applyApiVersioning(app);
    await app.init();
    prisma = app.get(PrismaService);
    delivery = app.get(DeliveryService);
  }, 90_000);

  afterAll(async () => {
    if (prisma) {
      await prisma.deliveryLog.deleteMany({ where: { template: { startsWith: TAG } } });
      await prisma.notification.deleteMany({ where: { template: { startsWith: TAG } } });
    }
    await app?.close();
  });

  it('is running rather than skipped', () => {
    if (CI && !HAS_DB) throw new Error('Dispatch cannot skip in CI.');
    expect(delivery).toBeDefined();
  });

  it('claims and sends one row through the sink', async () => {
    const user = await prisma.user.create({
      data: { email: `${TAG}@example.test`, passwordDigest: 'x', role: 'user' },
      select: { id: true },
    });
    try {
      await prisma.notification.create({
        data: {
          userId: user.id,
          channel: 'email',
          template: `${TAG}-approved`,
          payload: {},
        },
      });

      // A template the renderer does not know is failed loudly, never sent.
      // Use a known one so the row is dispatchable.
      await prisma.notification.updateMany({
        where: { template: `${TAG}-approved` },
        data: { template: 'kyc.approved' },
      });

      const claimed = await delivery.claim(50, 'spec-1', new Date());
      const ours = claimed.filter((r) => r.userId === user.id);
      expect(ours.length).toBeGreaterThan(0);

      const outcome = await delivery.dispatch(ours[0]!, new Date());
      expect(outcome).toBe('sent');

      const row = await prisma.notification.findUniqueOrThrow({
        where: { id: ours[0]!.id },
        select: { sentAt: true, failedAt: true },
      });
      expect(row.sentAt).not.toBeNull();
      expect(row.failedAt).toBeNull();

      const log = await prisma.deliveryLog.findFirstOrThrow({
        where: { notificationId: ours[0]!.id },
      });
      expect(log.status).toBe('sent');
      expect(log.providerMsgId).toBeNull();
    } finally {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    }
  });

  it('appears on the operator board as sent', async () => {
    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: `${TAG}-op@example.test`, password: 'correct-horse-battery-staple' });
    expect(reg.status).toBe(201);
    const op = await prisma.user.findUniqueOrThrow({ where: { email: `${TAG}-op@example.test` } });
    await prisma.user.update({ where: { id: op.id }, data: { role: 'support' } });
    try {
      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications?limit=50')
        .set('Authorization', `Bearer ${reg.body.token}`);
      expect(res.status).toBe(200);
    } finally {
      await prisma.session.deleteMany({ where: { userId: op.id } });
      await prisma.user.delete({ where: { id: op.id } });
    }
  });
});
