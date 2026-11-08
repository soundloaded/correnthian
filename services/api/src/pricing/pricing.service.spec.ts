import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PricingService } from './pricing.service.js';

describe('PricingService', () => {
  let asset: { findUnique: ReturnType<typeof vi.fn> };
  let price: { create: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  let svc: PricingService;

  const assetRow = { id: 'a1', assetId: '1:0xabc:iss', symbol: 'PAXG', rails: ['provider'], redeemSupported: true };

  beforeEach(() => {
    asset = { findUnique: vi.fn().mockResolvedValue(assetRow) };
    price = {
      create: vi.fn().mockResolvedValue({}),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    };
    svc = new PricingService({ asset, assetPrice: price } as never);
  });

  it('refuses a price with no source — an unattributed number is a constant', async () => {
    await expect(svc.record('1:0xabc:iss', 2000, '  ')).rejects.toThrow(/must carry a source/);
  });

  it('refuses a non-positive price', async () => {
    await expect(svc.record('1:0xabc:iss', 0, 'lbma')).rejects.toThrow(/positive/);
  });

  it('reports when no price has ever been recorded', async () => {
    price.findFirst.mockResolvedValue(null);
    const r = await svc.latest('1:0xabc:iss');
    expect(r.found).toBe(false);
  });

  it('marks a stale price stale rather than presenting it as current', async () => {
    const old = new Date(Date.now() - 3600_000);
    price.findFirst.mockResolvedValue({ assetId: 'a1', priceUsd: 2000, source: 'lbma', capturedAt: old });
    const r = await svc.latest('1:0xabc:iss');
    expect(r.found && r.stale).toBe(true);
    expect(r.found && r.ageSeconds).toBeGreaterThan(300);
  });

  it('does not mark a Chainlink round stale 301 seconds after its updatedAt', async () => {
    const capturedAt = new Date(Date.now() - 301_000);
    price.findFirst.mockResolvedValue({
      assetId: 'a1',
      priceUsd: 4100,
      source: 'chainlink:xau-usd',
      capturedAt,
    });
    const r = await svc.latest('1:0xabc:iss');
    expect(r).toMatchObject({
      found: true,
      stale: false,
      source: 'chainlink:xau-usd',
      capturedAt: capturedAt.toISOString(),
    });
    if (!r.found) return;
    expect(r.ageSeconds).toBeGreaterThanOrEqual(301);
    expect(r.ageSeconds).toBeLessThan(86_400);
  });

  it('marks a Chainlink round stale once it is older than the 86400-second heartbeat', async () => {
    const capturedAt = new Date(Date.now() - 86_401_000);
    price.findFirst.mockResolvedValue({
      assetId: 'a1',
      priceUsd: 4100,
      source: 'chainlink:xau-usd',
      capturedAt,
    });
    const r = await svc.latest('1:0xabc:iss');
    expect(r).toMatchObject({ found: true, stale: true, source: 'chainlink:xau-usd' });
    if (!r.found) return;
    expect(r.ageSeconds).toBeGreaterThan(86_400);
  });

  it('still marks a non-Chainlink price stale after 300 seconds', async () => {
    price.findFirst.mockResolvedValue({
      assetId: 'a1',
      priceUsd: 2000,
      source: 'lbma',
      capturedAt: new Date(Date.now() - 301_000),
    });
    const r = await svc.latest('1:0xabc:iss');
    expect(r).toMatchObject({ found: true, stale: true, source: 'lbma' });
  });

  it('does not present a reference price as an executable one', async () => {
    price.findFirst.mockResolvedValue({
      assetId: 'a1', priceUsd: 2000, source: 'lbma', capturedAt: new Date(),
    });
    const q = await svc.quote('1:0xabc:iss', 500);
    expect(q.found).toBe(true);
    if (!q.found) return;
    expect(q.executablePriceUsd).toBeNull();
    expect(q.spreadUsd).toBeNull();
    expect(q.note).toMatch(/not obtainable/);
    expect(q.notionalUsd).toBe(500);
  });

  it('keys the valuation map by the surrogate id it was given', async () => {
    price.findMany.mockResolvedValue([
      { assetId: 'a1', priceUsd: 2000, source: 'lbma', capturedAt: new Date() },
    ]);
    const map = await svc.latestMap(['a1']);
    expect(map).toEqual({ a1: 2000 });
  });

  it('omits stale prices from valuation rather than valuing on them', async () => {
    price.findMany.mockResolvedValue([
      { assetId: 'a1', priceUsd: 2000, source: 'lbma', capturedAt: new Date(Date.now() - 3_600_000) },
    ]);
    expect(await svc.latestMap(['a1'])).toEqual({});
  });

  it('keeps a Chainlink round in valuation 301 seconds after its updatedAt', async () => {
    price.findMany.mockResolvedValue([
      {
        assetId: 'a1',
        priceUsd: 4100,
        source: 'chainlink:xau-usd',
        capturedAt: new Date(Date.now() - 301_000),
      },
    ]);
    expect(await svc.latestMap(['a1'])).toEqual({ a1: 4100 });
  });

  it('omits a Chainlink round from valuation once it is older than the heartbeat', async () => {
    price.findMany.mockResolvedValue([
      {
        assetId: 'a1',
        priceUsd: 4100,
        source: 'chainlink:xau-usd',
        capturedAt: new Date(Date.now() - 86_401_000),
      },
    ]);
    expect(await svc.latestMap(['a1'])).toEqual({});
  });

  it('returns an empty map for no assets without querying', async () => {
    expect(await svc.latestMap([])).toEqual({});
    expect(price.findMany).not.toHaveBeenCalled();
  });
});
