import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { applyApiVersioning } from '../src/versioning/apply-versioning.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { CONTRACT_REGISTRY } from '@correnthian/contracts';

/**
 * The client configuration over HTTP — BE-1507.
 *
 * This route is public, so the thing worth testing is not that it answers but
 * that it answers with *nothing it should not*. A published route is a
 * disclosure: whatever it carries, anyone can read.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const CI = Boolean(process.env.CI);
const DISABLED_CHAIN_ID = `spec-disabled-${process.pid}`;

describe.skipIf(!HAS_DB && !CI)('the client config publishes what a client needs, and nothing else', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    applyApiVersioning(app);
    await app.init();
    prisma = app.get(PrismaService);

    // A chain that exists but is not enabled: it must not be published.
    await prisma.chain.create({
      data: {
        id: DISABLED_CHAIN_ID,
        name: 'Spec Disabled Chain',
        family: 'evm',
        nativeSymbol: 'SPEC',
        enabled: false,
        rpcUrls: ['https://rpc.example.test/spec'],
      },
    });
  }, 90_000);

  afterAll(async () => {
    await prisma?.chain.deleteMany({ where: { id: DISABLED_CHAIN_ID } });
    await app?.close();
  });

  it('answers without a session, because a client must be able to read it before it has one', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/config');
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(CONTRACT_REGISTRY['GET /api/v1/config'].safeParse(res.body).success).toBe(true);
  });

  it('publishes the API version and the maintenance state', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/config');
    expect(res.body.version).toBe('v1');
    expect(res.body.maintenance).toMatchObject({ active: false });
    // The message is either something an operator wrote or nothing at all.
    expect(
      res.body.maintenance.message === null || typeof res.body.maintenance.message === 'string',
    ).toBe(true);
  });

  it('publishes the enabled chains and nothing else', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/config');
    const chains = res.body.chains as Array<Record<string, unknown>>;

    const ids = chains.map((chain) => chain.id);
    expect(ids).not.toContain(DISABLED_CHAIN_ID);

    for (const chain of chains) {
      // The operator view counts the assets and wallets on a chain. Those
      // counts are platform totals, and this route is public.
      expect(Object.keys(chain)).toEqual(
        expect.arrayContaining(['id', 'name', 'family', 'nativeSymbol', 'decimals', 'isTestnet']),
      );
      expect(chain).not.toHaveProperty('rpcUrls');
      expect(chain).not.toHaveProperty('_count');
      expect(chain).not.toHaveProperty('gasPriceUsd');
    }
  });
});
