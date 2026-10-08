import { describe, expect, it, vi } from 'vitest';
import { EvmAdapter } from '../evm.js';
import type { ChainDescriptor } from '../adapter.js';

/**
 * `getTokenTransfers` — BE-302's read side.
 *
 * The interesting behaviour is not the RPC call, it is what happens after it:
 * a watcher sees its own transfer in *both* direction queries, ERC-721 shares
 * topic0 with ERC-20 and cannot be decoded against this ABI, and a re-run over
 * the same range must produce the same array. Each of those is asserted here
 * rather than against a live network, because none of them are network
 * behaviour.
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

interface FakeLog {
  transactionHash: string;
  logIndex: number;
  blockNumber: bigint;
  address: `0x${string}`;
  args?: { from?: string; to?: string; value?: bigint };
}

/**
 * An adapter whose `read` is replaced wholesale, so no RPC client is ever
 * constructed and no network is touched. `read` is private, hence the cast —
 * the alternative is driving a live chain to assert that sorting works.
 */
function adapterReturning(logs: FakeLog[][]) {
  const adapter = new EvmAdapter(descriptor, ['http://localhost:1']);
  const getLogs = vi
    .fn()
    .mockResolvedValueOnce(logs[0] ?? [])
    .mockResolvedValueOnce(logs[1] ?? []);

  const patched = adapter as unknown as {
    read: (fn: (c: { getLogs: typeof getLogs }) => Promise<unknown>) => Promise<unknown>;
  };
  vi.spyOn(patched, 'read').mockImplementation(async (fn) => fn({ getLogs }));

  return { adapter, getLogs };
}

const log = (over: Partial<FakeLog>): FakeLog => ({
  transactionHash: '0xtx',
  logIndex: 0,
  blockNumber: 100n,
  address: '0xaaa' as `0x${string}`,
  args: { from: '0x1', to: '0x2', value: 500n },
  ...over,
});

describe('EvmAdapter.getTokenTransfers', () => {
  it('issues one filter per direction, because eth_getLogs constrains one position', async () => {
    const { adapter, getLogs } = adapterReturning([[], []]);
    await adapter.getTokenTransfers({ addresses: ['0xAbC'], fromBlock: 1n, toBlock: 2n });

    expect(getLogs).toHaveBeenCalledTimes(2);
    const [a, b] = getLogs.mock.calls.map((c) => c[0]);
    expect(a.args).toEqual({ from: ['0xabc'] });
    expect(b.args).toEqual({ to: ['0xabc'] });
    expect(a.fromBlock).toBe(1n);
    expect(a.toBlock).toBe(2n);
  });

  it('counts a transfer between two watched addresses once', async () => {
    const both = log({ transactionHash: '0xself', args: { from: '0xabc', to: '0xabc', value: 1n } });
    const { adapter } = adapterReturning([[both], [both]]);

    const out = await adapter.getTokenTransfers({
      addresses: ['0xAbC'],
      fromBlock: 1n,
      toBlock: 10n,
    });

    // Both queries match a self-transfer. Counting it twice would double every
    // move a wallet makes with itself.
    expect(out).toHaveLength(1);
    expect(out[0]?.txHash).toBe('0xself');
  });

  it('skips a log it cannot decode rather than failing the page', async () => {
    // ERC-721 shares topic0 but puts the token id in the topics, so `value` is
    // not in `data` and this ABI cannot read it.
    const undecodable = log({ transactionHash: '0x721', args: {} });
    const good = log({ transactionHash: '0x20', blockNumber: 99n });
    const { adapter } = adapterReturning([[undecodable, good], []]);

    const out = await adapter.getTokenTransfers({ addresses: ['0xabc'], fromBlock: 1n, toBlock: 10n });

    expect(out).toHaveLength(1);
    expect(out[0]?.txHash).toBe('0x20');
  });

  it('returns a stable order: block, then log index', async () => {
    const a = log({ transactionHash: '0xa', blockNumber: 12n, logIndex: 4 });
    const b = log({ transactionHash: '0xb', blockNumber: 10n, logIndex: 9 });
    const c = log({ transactionHash: '0xc', blockNumber: 10n, logIndex: 2 });
    const { adapter } = adapterReturning([[a, b, c], []]);

    const out = await adapter.getTokenTransfers({ addresses: ['0xabc'], fromBlock: 1n, toBlock: 20n });
    expect(out.map((t) => t.txHash)).toEqual(['0xc', '0xb', '0xa']);
  });

  it('asks for nothing when there is nothing to ask about', async () => {
    const { adapter, getLogs } = adapterReturning([[], []]);

    expect(
      await adapter.getTokenTransfers({ addresses: [], fromBlock: 1n, toBlock: 2n }),
    ).toEqual([]);
    expect(
      await adapter.getTokenTransfers({ addresses: ['0xabc'], fromBlock: 5n, toBlock: 2n }),
    ).toEqual([]);
    expect(getLogs).not.toHaveBeenCalled();
  });

  it('reports the token as its contract address, never a ticker', async () => {
    const { adapter } = adapterReturning([[log({ address: '0xdeadbeef' as `0x${string}` })], []]);
    const out = await adapter.getTokenTransfers({ addresses: ['0xabc'], fromBlock: 1n, toBlock: 2n });

    expect(out[0]?.token).toBe('0xdeadbeef');
    expect(out[0]?.amountRaw).toBe('500');
  });
});
