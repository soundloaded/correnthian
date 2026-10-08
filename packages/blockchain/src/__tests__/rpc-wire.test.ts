import { describe, expect, it, vi } from 'vitest';
import { EvmAdapter } from '../evm.js';
import type { ChainDescriptor } from '../adapter.js';

/**
 * `getTokenTransfers` against the JSON-RPC wire rather than a stubbed `read`.
 *
 * `transfers.test.ts` stubs the adapter's private `read`, which is the right
 * place for *our* logic — de-duplication, sorting, what an undecodable log does
 * — because none of that is network behaviour. What stubbing skips is the
 * stretch between the wire and that logic: whether viem encodes `args.from` and
 * `args.to` into `topics` where this implementation assumes, and whether it
 * decodes a node's log back into `from`, `to` and `value`.
 *
 * Those are assumptions, not behaviour we wrote, and a wrong one fails
 * silently in one direction only: a filter that matches nothing is
 * indistinguishable from a chain with no activity. So `fetch` is stubbed one
 * layer lower — still no network — and answered in the shape a node uses.
 */

const descriptor: ChainDescriptor = {
  chainId: '1',
  family: 'evm',
  nativeSymbol: 'ETH',
  decimals: 18,
  explorerUrl: null,
  enabled: true,
  isTestnet: false,
};

const TOKEN = '0xcccccccccccccccccccccccccccccccccccccccc';
const ALICE = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const BOB = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

const TRANSFER_TOPIC0 =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

/** A 32-byte topic carrying an address: 12 zero bytes, then the 20. */
const addressTopic = (address: string): string =>
  '0x' + address.slice(2).toLowerCase().padStart(64, '0');

interface WireLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  transactionIndex: string;
  blockHash: string;
  logIndex: string;
  removed: boolean;
}

function erc20Log(partial: {
  from: string;
  to: string;
  amount: bigint;
  blockNumber: bigint;
  txIndex?: number;
  logIndex?: number;
}): WireLog {
  const i = partial.txIndex ?? 0;
  return {
    address: TOKEN,
    topics: [TRANSFER_TOPIC0, addressTopic(partial.from), addressTopic(partial.to)],
    data: '0x' + partial.amount.toString(16).padStart(64, '0'),
    blockNumber: '0x' + partial.blockNumber.toString(16),
    transactionHash: `0x${i.toString(16).padStart(64, '0')}`,
    transactionIndex: '0x' + i.toString(16),
    blockHash: `0x${'b'.repeat(64)}`,
    logIndex: '0x' + (partial.logIndex ?? i).toString(16),
    removed: false,
  };
}

/**
 * A node answering each direction filter separately.
 *
 * `topics[1]` set means "the sender is the one being asked about"; `topics[2]`
 * set means the receiver is. That split is what `eth_getLogs` allows — one
 * indexed position per filter — and it is the assumption this file pins.
 */
function serve(responses: { from?: WireLog[]; to?: WireLog[] }) {
  const requests: Array<{ topics: (string | null | string[])[] }> = [];
  const fetchMock = vi.fn(async (_url: unknown, init?: { body?: string }) => {
    const body = init?.body
      ? (JSON.parse(init.body) as { id: number; params: [{ topics: (string | null | string[])[] }] })
      : null;
    const filter = body?.params?.[0];
    if (!filter) throw new Error('request carried no filter');
    requests.push({ topics: filter.topics });

    const isSenderQuery =
      filter.topics[1] !== null && filter.topics[1] !== undefined;
    const result = isSenderQuery ? (responses.from ?? []) : (responses.to ?? []);

    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body?.id ?? 0, result }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { requests, restore: () => vi.unstubAllGlobals() };
}

const adapter = () => new EvmAdapter(descriptor, [{ url: 'http://rpc.test' }]);

describe('getTokenTransfers over the wire', () => {
  it('puts each direction in its own topic position and decodes the log back', async () => {
    const incoming = erc20Log({ from: BOB, to: ALICE, amount: 1_000_000n, blockNumber: 100n, txIndex: 1 });
    const outgoing = erc20Log({
      from: ALICE, to: BOB, amount: 7n, blockNumber: 101n, txIndex: 2, logIndex: 4,
    });
    const wire = serve({ from: [outgoing], to: [incoming] });

    try {
      const transfers = await adapter().getTokenTransfers({
        addresses: [ALICE],
        fromBlock: 1n,
        toBlock: 200n,
      });

      expect(wire.requests).toHaveLength(2);
      expect(wire.requests[0]?.topics[0]).toBe(TRANSFER_TOPIC0);
      expect(wire.requests[0]?.topics[1]).toEqual([addressTopic(ALICE)]);
      expect(wire.requests[0]?.topics[2]).toBeNull();
      expect(wire.requests[1]?.topics[1]).toBeNull();
      expect(wire.requests[1]?.topics[2]).toEqual([addressTopic(ALICE)]);

      expect(transfers).toHaveLength(2);
      // Sorted by block then log index, and addresses come back **checksummed**
      // — the indexer lower-cases before it looks an address up, and this is
      // what makes that necessary rather than defensive.
      expect(transfers[0]).toMatchObject({
        token: TOKEN,
        from: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
        to: '0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa',
        amountRaw: '1000000',
        blockNumber: 100n,
        logIndex: 1,
      });
      expect(transfers[1]).toMatchObject({
        from: '0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa',
        to: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
        amountRaw: '7',
        blockNumber: 101n,
        logIndex: 4,
      });
    } finally {
      wire.restore();
    }
  });

  it('collapses a watcher seeing its own transfer in both queries', async () => {
    const self = erc20Log({
      from: ALICE, to: ALICE, amount: 5n, blockNumber: 100n, txIndex: 1,
    });
    const wire = serve({ from: [self], to: [self] });

    try {
      const transfers = await adapter().getTokenTransfers({
        addresses: [ALICE],
        fromBlock: 1n,
        toBlock: 200n,
      });
      expect(transfers).toHaveLength(1);
      expect(transfers[0]?.amountRaw).toBe('5');
    } finally {
      wire.restore();
    }
  });

  it('drops an ERC-721 transfer: it shares topic0 but has no value to decode', async () => {
    // The real ERC-721 shape — `tokenId` is indexed, so `data` is empty.
    // viem cannot decode `value` from it and hands back the log with no args;
    // the adapter skips rather than throws, which is what `strict: false`
    // buys here.
    const nft: WireLog = {
      ...erc20Log({ from: BOB, to: ALICE, amount: 1n, blockNumber: 100n, txIndex: 1 }),
      topics: [
        TRANSFER_TOPIC0,
        addressTopic(BOB),
        addressTopic(ALICE),
        '0x' + '9'.repeat(64),
      ],
      data: '0x',
    };
    const erc20 = erc20Log({ from: BOB, to: ALICE, amount: 42n, blockNumber: 101n, txIndex: 2 });
    const wire = serve({ to: [nft, erc20] });

    try {
      const transfers = await adapter().getTokenTransfers({
        addresses: [ALICE],
        fromBlock: 1n,
        toBlock: 200n,
      });
      expect(transfers).toHaveLength(1);
      expect(transfers[0]?.amountRaw).toBe('42');
    } finally {
      wire.restore();
    }
  });

  it('skips a log whose value does not decode without losing the rest of the range', async () => {
    // Not a uint256 — 32 bytes are required. A node mid-reindex can answer
    // with something half-written, and one unreadable log must not fail the
    // whole scan.
    const broken: WireLog = {
      ...erc20Log({ from: BOB, to: ALICE, amount: 1n, blockNumber: 100n, txIndex: 1 }),
      data: '0x01',
    };
    const good = erc20Log({ from: BOB, to: ALICE, amount: 8n, blockNumber: 102n, txIndex: 2 });
    const wire = serve({ to: [broken, good] });

    try {
      const transfers = await adapter().getTokenTransfers({
        addresses: [ALICE],
        fromBlock: 1n,
        toBlock: 200n,
      });
      expect(transfers).toHaveLength(1);
      expect(transfers[0]?.amountRaw).toBe('8');
    } finally {
      wire.restore();
    }
  });

  it('makes no request when there is nothing to ask', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    try {
      const a = adapter();
      expect(await a.getTokenTransfers({ addresses: [], fromBlock: 1n, toBlock: 10n })).toEqual([]);
      expect(await a.getTokenTransfers({ addresses: [ALICE], fromBlock: 10n, toBlock: 1n })).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
