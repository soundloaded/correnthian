import { EvmAdapter } from '@correnthian/blockchain';
import { describe, expect, it, vi } from 'vitest';
import type { ChainDescriptor } from '@correnthian/blockchain';
import {
  ChainlinkPriceProvider,
  EvmChainlinkFeedReader,
  PrismaPricedAssetSource,
} from './chainlink-price.provider.js';
import type {
  FeedReader,
  PricedAsset,
  PricedAssetSource,
} from './chainlink-price.provider.js';
import { FakePriceProvider } from './fake-price.provider.js';
import { priceProvider } from './pricing.module.js';
import { PriceUnavailableError } from './price-provider.js';
import type { ConfigService } from '../config/config.service.js';

/**
 * Chainlink is a reference, not a buy price.
 *
 * The break each case names is a number that should never be recorded:
 * a stale round, a non-positive answer, a stablecoin priced off gold, or
 * a feed that was never configured. The reader and the asset list are
 * stubs here — the registry rows are not what this file is proving.
 */

const NOW = new Date('2026-11-08T06:00:00.000Z');
/** Synthetic. Not a Chainlink proxy — a stand-in so the test can see which feed was read. */
const XAU_FEED = `0x${'a'.repeat(40)}` as const;
const XAG_FEED = `0x${'b'.repeat(40)}` as const;

const PAXG: PricedAsset = {
  assetId: '1:0xpaxg:paxos',
  symbol: 'PAXG',
  category: 'metal',
  ouncesPerToken: 1,
};

const USDC: PricedAsset = {
  assetId: '1:0xusdc:circle',
  symbol: 'USDC',
  category: 'stablecoin',
  ouncesPerToken: null,
};

const TEN_OUNCE: PricedAsset = {
  assetId: '1:0xbar:iss',
  symbol: 'BAR',
  category: 'metal',
  ouncesPerToken: 10,
};

const XAG: PricedAsset = {
  assetId: '1:0xsilver:iss',
  symbol: 'XAG',
  category: 'metal',
  ouncesPerToken: 1,
};

const ethereum: ChainDescriptor = {
  chainId: '1',
  family: 'evm',
  nativeSymbol: 'ETH',
  decimals: 18,
  explorerUrl: null,
  enabled: true,
  isTestnet: false,
};

function updatedAt(ageSeconds: number): bigint {
  return BigInt(Math.floor(NOW.getTime() / 1000) - ageSeconds);
}

function assetsOf(rows: readonly PricedAsset[]): PricedAssetSource {
  return { listEnabled: async () => rows };
}

function roundReader(
  round: { answer: bigint; updatedAt: bigint; decimals: number } | null,
): FeedReader & {
  latestRound: ReturnType<typeof vi.fn>;
} {
  return {
    latestRound: vi.fn(async () => round),
  };
}

function provider(input: {
  rows: readonly PricedAsset[];
  round: { answer: bigint; updatedAt: bigint; decimals: number } | null;
  xauUsd?: `0x${string}`;
  xagUsd?: `0x${string}`;
}) {
  const read = roundReader(input.round);
  const prices = new ChainlinkPriceProvider(
    { xauUsd: input.xauUsd, xagUsd: input.xagUsd },
    read,
    assetsOf(input.rows),
    () => NOW,
  );
  return { prices, read };
}

const fresh = {
  answer: 4100_00000000n,
  updatedAt: updatedAt(0),
  decimals: 8,
};

describe('ChainlinkPriceProvider', () => {
  it('prices a 1-ounce metal from the XAU round and does not read the silver feed', async () => {
    // 4100_00000000 at 8 decimals is 4100 dollars per ounce. One token is one
    // ounce, so the reference is 4100, attributed to the feed that produced it.
    const { prices, read } = provider({
      rows: [PAXG],
      round: fresh,
      xauUsd: XAU_FEED,
      xagUsd: XAG_FEED,
    });

    await expect(prices.spotPrices()).resolves.toEqual([
      {
        assetId: '1:0xpaxg:paxos',
        priceUsd: 4100,
        source: 'chainlink:xau-usd',
      },
    ]);
    expect(read.latestRound).toHaveBeenCalledWith(XAU_FEED);
    expect(read.latestRound).not.toHaveBeenCalledWith(XAG_FEED);
  });

  it('keeps a round older than 300 seconds while it is inside the heartbeat', async () => {
    // 300 seconds is the manual-price window. Chainlink's published heartbeat
    // is 86400 seconds, so a round at 301 seconds is still a reference price.
    const { prices } = provider({
      rows: [PAXG],
      round: { answer: 4100_00000000n, updatedAt: updatedAt(301), decimals: 8 },
      xauUsd: XAU_FEED,
      xagUsd: XAG_FEED,
    });

    await expect(prices.spotPrices()).resolves.toEqual([
      {
        assetId: '1:0xpaxg:paxos',
        priceUsd: 4100,
        source: 'chainlink:xau-usd',
      },
    ]);
  });

  it('omits a round older than 86400 seconds without throwing', async () => {
    const { prices } = provider({
      rows: [PAXG],
      round: {
        answer: 4100_00000000n,
        updatedAt: updatedAt(86_401),
        decimals: 8,
      },
      xauUsd: XAU_FEED,
    });

    await expect(prices.spotPrices()).resolves.toEqual([]);
  });

  it.each([0n, -1n])(
    'omits a non-positive answer (%s) without throwing',
    async (answer) => {
      const { prices } = provider({
        rows: [PAXG],
        round: { answer, updatedAt: updatedAt(0), decimals: 8 },
        xauUsd: XAU_FEED,
      });

      await expect(prices.spotPrices()).resolves.toEqual([]);
    },
  );

  it('does not price USDC, or a metal that is not one ounce, from the gold feed', async () => {
    const { prices } = provider({
      rows: [PAXG, USDC, TEN_OUNCE],
      round: fresh,
      xauUsd: XAU_FEED,
      xagUsd: XAG_FEED,
    });

    const rows = await prices.spotPrices();

    expect(rows).toEqual([
      {
        assetId: '1:0xpaxg:paxos',
        priceUsd: 4100,
        source: 'chainlink:xau-usd',
      },
    ]);
    expect(rows.map((row) => row.assetId)).not.toContain(USDC.assetId);
    expect(rows.map((row) => row.assetId)).not.toContain(TEN_OUNCE.assetId);
  });

  it('prices an XAG metal from the silver feed and not from gold', async () => {
    const { prices, read } = provider({
      rows: [XAG, PAXG],
      round: { answer: 30_00000000n, updatedAt: updatedAt(0), decimals: 8 },
      xauUsd: XAU_FEED,
      xagUsd: XAG_FEED,
    });

    const rows = await prices.spotPrices();

    expect(read.latestRound).toHaveBeenCalledWith(XAG_FEED);
    expect(rows).toContainEqual({
      assetId: '1:0xsilver:iss',
      priceUsd: 30,
      source: 'chainlink:xag-usd',
    });
    expect(rows.find((row) => row.assetId === XAG.assetId)?.source).not.toBe(
      'chainlink:xau-usd',
    );
  });

  it('omits the asset when the feed returns nothing, and does not throw', async () => {
    // An RPC failure is the reader's null. That is one asset with no row,
    // not a vendor outage that abandons the run.
    const { prices } = provider({
      rows: [PAXG],
      round: null,
      xauUsd: XAU_FEED,
    });

    await expect(prices.spotPrices()).resolves.toEqual([]);
  });

  it('is unavailable without an XAU feed and refuses to invent a price', async () => {
    const listEnabled = vi.fn(async () => [PAXG]);
    const read = roundReader(fresh);
    const prices = new ChainlinkPriceProvider(
      { xagUsd: XAG_FEED },
      read,
      { listEnabled },
      () => NOW,
    );

    await expect(prices.isAvailable()).resolves.toBe(false);
    await expect(prices.spotPrices()).rejects.toBeInstanceOf(
      PriceUnavailableError,
    );
    expect(listEnabled).not.toHaveBeenCalled();
    expect(read.latestRound).not.toHaveBeenCalled();
  });

  it('is available when the XAU feed is configured, without reading it', async () => {
    const { prices, read } = provider({
      rows: [],
      round: null,
      xauUsd: XAU_FEED,
    });

    await expect(prices.isAvailable()).resolves.toBe(true);
    expect(read.latestRound).not.toHaveBeenCalled();
  });
});

describe('EvmChainlinkFeedReader', () => {
  it('reads latestRoundData and decimals on Ethereum mainnet', async () => {
    const adapter = new EvmAdapter(ethereum, [{ url: 'http://127.0.0.1:1' }]);
    const readContract = vi.fn(
      async ({ functionName }: { functionName: string }) => {
        if (functionName === 'decimals') return 8;
        if (functionName === 'latestRoundData') {
          return [99n, 4100_00000000n, 0n, 1_700_000_000n, 99n];
        }
        throw new Error(`unexpected ${functionName}`);
      },
    );
    vi.spyOn(
      adapter as unknown as {
        read: (
          fn: (client: {
            readContract: typeof readContract;
          }) => Promise<unknown>,
        ) => Promise<unknown>;
      },
      'read',
    ).mockImplementation(async (fn) => fn({ readContract }));

    const forChain = vi.fn(async () => adapter);
    const reader = new EvmChainlinkFeedReader({ forChain });

    await expect(reader.latestRound(XAU_FEED)).resolves.toEqual({
      answer: 4100_00000000n,
      updatedAt: 1_700_000_000n,
      decimals: 8,
    });
    expect(forChain).toHaveBeenCalledWith('1');
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: XAU_FEED,
        functionName: 'latestRoundData',
      }),
    );
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ address: XAU_FEED, functionName: 'decimals' }),
    );
  });

  it('returns null when the chain cannot be read', async () => {
    const down = new EvmChainlinkFeedReader({
      forChain: async () => {
        throw new Error('no rpc');
      },
    });
    await expect(down.latestRound(XAU_FEED)).resolves.toBeNull();

    const adapter = new EvmAdapter(ethereum, [{ url: 'http://127.0.0.1:1' }]);
    vi.spyOn(
      adapter as unknown as { read: () => Promise<unknown> },
      'read',
    ).mockRejectedValue(new Error('timeout'));
    const failing = new EvmChainlinkFeedReader({
      forChain: async () => adapter,
    });
    await expect(failing.latestRound(XAU_FEED)).resolves.toBeNull();
  });
});

describe('PrismaPricedAssetSource', () => {
  it('reads enabled assets and keeps a null ounce weight null', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        assetId: '1:0xpaxg:paxos',
        symbol: 'PAXG',
        category: 'metal',
        ouncesPerToken: { valueOf: () => 1 },
      },
      {
        assetId: '1:0xusdc:circle',
        symbol: 'USDC',
        category: 'stablecoin',
        ouncesPerToken: null,
      },
    ]);
    const source = new PrismaPricedAssetSource({
      asset: { findMany },
    } as never);

    await expect(source.listEnabled()).resolves.toEqual([
      {
        assetId: '1:0xpaxg:paxos',
        symbol: 'PAXG',
        category: 'metal',
        ouncesPerToken: 1,
      },
      {
        assetId: '1:0xusdc:circle',
        symbol: 'USDC',
        category: 'stablecoin',
        ouncesPerToken: null,
      },
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { enabled: true } }),
    );
  });
});

describe('priceProvider', () => {
  it('uses Chainlink only when the XAU feed is configured', async () => {
    const missing = priceProvider(
      { value: { chainlink: {} } } as ConfigService,
      {} as never,
      {} as never,
    );
    expect(missing).toBeInstanceOf(FakePriceProvider);

    const present = priceProvider(
      { value: { chainlink: { xauUsd: XAU_FEED } } } as ConfigService,
      {} as never,
      {} as never,
    );
    expect(present).toBeInstanceOf(ChainlinkPriceProvider);
    expect(present.name).toBe('chainlink');
    await expect(present.isAvailable()).resolves.toBe(true);
  });
});
