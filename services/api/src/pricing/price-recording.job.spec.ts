import { describe, expect, it, vi } from 'vitest';
import { PriceRecordingJob } from './price-recording.job.js';
import { ChainlinkPriceProvider } from './chainlink-price.provider.js';
import { FakePriceProvider } from './fake-price.provider.js';
import type { JobContext } from '../jobs/job.js';

/**
 * The recording job — BE-502's delivery.
 *
 * What the job must not do is the whole suite: it must not record a price
 * the vendor never gave, must not carry a stale one forward, and must not
 * treat a vendor outage as a scheduler fault. The fakes below read the
 * same registry the service reads — an asset keyed by domain id, resolved
 * to its surrogate before the write — so a mix-up of the two id shapes is
 * an empty write set here rather than a silent one.
 */

const T0 = new Date('2026-10-22T05:00:00.000Z');
const ctx = (): JobContext => {
  const controller = new AbortController();
  return {
    now: T0,
    deadline: new Date(T0.getTime() + 60_000),
    signal: controller.signal,
    trigger: 'schedule',
  };
};

function makePrisma(assets: Array<{ assetId: string; id: string }>) {
  const created: Array<{ assetId: string; priceUsd: number; source: string; capturedAt: Date }> = [];
  return {
    created,
    asset: {
      findUnique: vi.fn(async ({ where }: { where: { assetId: string } }) => {
        const found = assets.find((a) => a.assetId === where.assetId);
        return found ? { id: found.id } : null;
      }),
    },
    assetPrice: {
      create: vi.fn(async ({ data }: { data: (typeof created)[number] }) => {
        created.push({ ...data });
        return data;
      }),
    },
  };
}

describe('PriceRecordingJob', () => {
  it('records what the vendor gave, for assets the registry holds', async () => {
    const prisma = makePrisma([{ assetId: '1:0xtoken:iss', id: 'surr-1' }]);
    const vendor = new FakePriceProvider();
    vendor.scriptPrice('1:0xtoken:iss', { priceUsd: 2650.5, source: 'lbma' });
    const job = new PriceRecordingJob(prisma as never, vendor);

    const outcome = await job.run(ctx());

    expect(outcome.affected).toBe(1);
    expect(prisma.created).toHaveLength(1);
    expect(prisma.created[0]).toMatchObject({
      assetId: 'surr-1',
      priceUsd: 2650.5,
      source: 'lbma',
      capturedAt: T0,
    });
  });

  it('records nothing for an asset the registry does not hold, and names it', async () => {
    const prisma = makePrisma([]);
    const vendor = new FakePriceProvider();
    vendor.scriptPrice('1:0xunknown:iss', { priceUsd: 10, source: 'lbma' });
    const job = new PriceRecordingJob(prisma as never, vendor);

    const outcome = await job.run(ctx());

    expect(outcome.affected).toBe(0);
    expect(prisma.created).toHaveLength(0);
    expect(outcome.detail).toMatchObject({ skipped: ['1:0xunknown:iss'] });
  });

  it('records nothing when the vendor is down, and does not fail the run', async () => {
    const prisma = makePrisma([{ assetId: '1:0xtoken:iss', id: 'surr-1' }]);
    const vendor = new FakePriceProvider();
    const job = new PriceRecordingJob(prisma as never, vendor);

    const outcome = await job.run(ctx());

    expect(outcome.affected).toBe(0);
    expect(prisma.created).toHaveLength(0);
    expect(outcome.detail).toMatchObject({ reason: expect.stringContaining('fake') });
  });

  it('stores a Chainlink round updated 301 seconds ago at that time', async () => {
    const roundTime = new Date(T0.getTime() - 301_000);
    const prices = new ChainlinkPriceProvider(
      { xauUsd: `0x${'a'.repeat(40)}` },
      {
        latestRound: async () => ({
          answer: 4100_00000000n,
          updatedAt: BigInt(Math.floor(roundTime.getTime() / 1000)),
          decimals: 8,
        }),
      },
      {
        listEnabled: async () => [
          {
            assetId: '1:0xpaxg:paxos',
            symbol: 'PAXG',
            category: 'metal',
            ouncesPerToken: 1,
          },
        ],
      },
      () => T0,
    );
    const prisma = makePrisma([{ assetId: '1:0xpaxg:paxos', id: 'surr-1' }]);
    const job = new PriceRecordingJob(prisma as never, prices);

    const outcome = await job.run(ctx());

    expect(outcome.affected).toBe(1);
    expect(prisma.created[0]).toMatchObject({
      assetId: 'surr-1',
      priceUsd: 4100,
      source: 'chainlink:xau-usd',
      capturedAt: roundTime,
    });
  });

  it('skips a malformed vendor price rather than writing it', async () => {
    const prisma = makePrisma([{ assetId: '1:0xtoken:iss', id: 'surr-1' }]);
    const vendor = new FakePriceProvider();
    vendor.scriptPrice('1:0xtoken:iss', { priceUsd: Number.NaN, source: 'lbma' });
    const job = new PriceRecordingJob(prisma as never, vendor);

    const outcome = await job.run(ctx());

    expect(outcome.affected).toBe(0);
    expect(outcome.detail).toMatchObject({ skipped: ['1:0xtoken:iss'] });
  });
});
