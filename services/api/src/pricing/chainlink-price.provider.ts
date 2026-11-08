import { EvmAdapter } from '@correnthian/blockchain';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  PriceProvider,
  PriceUnavailableError,
  type SpotPrice,
} from './price-provider.js';

/**
 * Heartbeat Chainlink publishes for Ethereum XAU/USD and XAG/USD: 86400
 * seconds. A round older than that is not a reference price. The 300-second
 * manual-price window is a different limit and does not apply here.
 */
const CHAINLINK_HEARTBEAT_SECONDS = 86_400;

/**
 * A Chainlink round, already decoded. `null` means the feed could not be
 * read — the caller records nothing for the assets that needed it.
 */
export interface FeedReader {
  latestRound(feed: `0x${string}`): Promise<{
    answer: bigint;
    updatedAt: bigint;
    decimals: number;
  } | null>;
}

/** An enabled registry row, reduced to what a reference price can use. */
export interface PricedAsset {
  assetId: string;
  symbol: string;
  category: string;
  ouncesPerToken: number | null;
}

export interface PricedAssetSource {
  listEnabled(): Promise<readonly PricedAsset[]>;
}

/**
 * Enabled assets, from the registry the recording job already trusts.
 *
 * Disabled rows are not priced: a feed for an asset the product is not
 * offering would write a history nobody asked for and the staleness sweep
 * would then have to explain.
 */
export class PrismaPricedAssetSource implements PricedAssetSource {
  constructor(private readonly prisma: PrismaService) {}

  async listEnabled(): Promise<readonly PricedAsset[]> {
    const rows = await this.prisma.asset.findMany({
      where: { enabled: true },
      select: {
        assetId: true,
        symbol: true,
        category: true,
        ouncesPerToken: true,
      },
    });
    return rows.map((row) => ({
      assetId: row.assetId,
      symbol: row.symbol,
      category: row.category,
      ouncesPerToken:
        row.ouncesPerToken === null ? null : Number(row.ouncesPerToken),
    }));
  }
}

/** Enough of `BlockchainService` to resolve Ethereum. The pricing module
 *  passes the real service; tests pass a double. */
export interface EthereumReader {
  forChain(chainId: string): Promise<unknown>;
}

/**
 * AggregatorV3, the interface every Chainlink price proxy exposes.
 * Kept here so the feed address stays configuration and the call shape
 * stays next to the only caller.
 */
const CHAINLINK_AGGREGATOR_ABI = [
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'latestRoundData',
    outputs: [
      { name: 'roundId', type: 'uint80' },
      { name: 'answer', type: 'int256' },
      { name: 'startedAt', type: 'uint256' },
      { name: 'updatedAt', type: 'uint256' },
      { name: 'answeredInRound', type: 'uint80' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

function readRound(
  value: unknown,
): { answer: bigint; updatedAt: bigint } | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as {
    1?: unknown;
    3?: unknown;
    answer?: unknown;
    updatedAt?: unknown;
  };
  const answer = row.answer ?? row[1];
  const updatedAt = row.updatedAt ?? row[3];
  if (typeof answer !== 'bigint' || typeof updatedAt !== 'bigint') return null;
  return { answer, updatedAt };
}

/**
 * Chainlink on Ethereum mainnet. A failed read is `null`, not a thrown
 * outage: one feed that does not answer omits the assets that needed it,
 * and the recording job writes no row for them.
 */
export class EvmChainlinkFeedReader implements FeedReader {
  constructor(private readonly chains: EthereumReader) {}

  async latestRound(feed: `0x${string}`): Promise<{
    answer: bigint;
    updatedAt: bigint;
    decimals: number;
  } | null> {
    try {
      const adapter = await this.chains.forChain('1');
      if (!(adapter instanceof EvmAdapter)) return null;

      const roundRaw = await adapter.readContract({
        address: feed,
        abi: CHAINLINK_AGGREGATOR_ABI,
        functionName: 'latestRoundData',
      });
      const decimalsRaw = await adapter.readContract({
        address: feed,
        abi: CHAINLINK_AGGREGATOR_ABI,
        functionName: 'decimals',
      });

      const round = readRound(roundRaw);
      const decimals = Number(decimalsRaw);
      if (
        !round ||
        !Number.isInteger(decimals) ||
        decimals < 0 ||
        decimals > 36
      )
        return null;
      return { answer: round.answer, updatedAt: round.updatedAt, decimals };
    } catch {
      return null;
    }
  }
}

/**
 * Reference prices from Chainlink, for 1-ounce metal only.
 *
 * XAU/USD prices every such metal except one whose symbol is `XAG`, which
 * reads the silver feed when that feed is configured. A stablecoin is not
 * gold, and a round older than the Chainlink heartbeat or not a positive
 * number is not a price.
 *
 * Nothing in this class is a buy. The recording job stores the result on
 * `AssetPrice`. It must never be copied into a swap's `toAmountRaw`.
 */
export class ChainlinkPriceProvider extends PriceProvider {
  readonly name = 'chainlink';

  constructor(
    private readonly feeds: { xauUsd?: `0x${string}`; xagUsd?: `0x${string}` },
    private readonly read: FeedReader,
    private readonly assets: PricedAssetSource,
    private readonly now: () => Date = () => new Date(),
  ) {
    super();
  }

  async isAvailable(): Promise<boolean> {
    return this.feeds.xauUsd !== undefined;
  }

  async spotPrices(): Promise<SpotPrice[]> {
    if (this.feeds.xauUsd === undefined) {
      throw new PriceUnavailableError(
        'Chainlink XAU/USD feed is not configured',
      );
    }

    const assets = await this.assets.listEnabled();
    const now = this.now();
    const byFeed = new Map<`0x${string}`, Promise<number | null>>();
    const out: SpotPrice[] = [];

    for (const asset of assets) {
      if (asset.category !== 'metal' || asset.ouncesPerToken !== 1) continue;
      const silver = asset.symbol === 'XAG';
      const feed = silver ? this.feeds.xagUsd : this.feeds.xauUsd;
      if (feed === undefined) continue;

      let pending = byFeed.get(feed);
      if (pending === undefined) {
        pending = this.reference(feed, now);
        byFeed.set(feed, pending);
      }
      const priceUsd = await pending;
      if (priceUsd === null) continue;
      out.push({
        assetId: asset.assetId,
        priceUsd,
        source: silver ? 'chainlink:xag-usd' : 'chainlink:xau-usd',
      });
    }

    return out;
  }

  /** Dollars per ounce, or null when the round must not be recorded. */
  private async reference(
    feed: `0x${string}`,
    now: Date,
  ): Promise<number | null> {
    const round = await this.read.latestRound(feed);
    if (round === null || round.answer <= 0n) return null;

    const updatedAtSeconds = Number(round.updatedAt);
    if (!Number.isFinite(updatedAtSeconds)) return null;
    const ageSeconds = now.getTime() / 1000 - updatedAtSeconds;
    if (ageSeconds > CHAINLINK_HEARTBEAT_SECONDS) return null;

    if (!Number.isInteger(round.decimals) || round.decimals < 0) return null;
    const priceUsd = Number(round.answer) / 10 ** round.decimals;
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) return null;
    return priceUsd;
  }
}
