import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeFunctionData, erc20Abi } from 'viem';
import { EvmAdapter } from '../evm.js';
import type { ChainDescriptor } from '../adapter.js';

/**
 * `buildTransaction` — BE-602.
 *
 * "The server assembles, the device signs" is only true if what the server
 * assembles is *signable*: a payload without a nonce or fee caps is a sketch,
 * and a device that fills those in itself is doing its own assembly — which
 * for this product means the sketch came from somewhere else entirely.
 *
 * Two shapes are assembled here, and which one is a fact about the asset, not
 * about a route: a native transfer moves value to the destination, an ERC-20
 * transfer moves 0 value to the *contract* with the amount in calldata.
 * Encoding that calldata is chain-specific knowledge, which is why it lives
 * behind the adapter rather than in the service that calls it — the same
 * reason log decoding does.
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

const ALICE = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const BOB = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const TOKEN = '0xcccccccccccccccccccccccccccccccccccccccc';

interface Recorded {
  method: string;
  params?: unknown[];
}

/** A node that answers the assembly calls, recording what was asked. */
function serveNode(options?: { gas?: string }) {
  const asked: Recorded[] = [];

  const handle = (m: Recorded) => {
    switch (m.method) {
      case 'eth_chainId':
        return '0x1';
      case 'eth_estimateGas': {
        // An ERC-20 transfer costs more than a value transfer; answering the
        // same gas for both would hide a payload built against the wrong call.
        const call = (m.params?.[0] ?? {}) as { data?: string };
        return (call.data && call.data !== '0x') ? (options?.gas ?? '0xc350') : '0x5208';
      }
      case 'eth_getTransactionCount':
        return '0x7';
      case 'eth_getBlockByNumber':
        return {
          number: '0x64', hash: `0x${'b'.repeat(64)}`, parentHash: `0x${'c'.repeat(64)}`,
          timestamp: '0x0', transactionsRoot: `0x${'0'.repeat(64)}`,
          stateRoot: `0x${'0'.repeat(64)}`, receiptsRoot: `0x${'0'.repeat(64)}`,
          miner: `0x${'0'.repeat(40)}`, difficulty: '0x0', totalDifficulty: '0x0',
          extraData: '0x', size: '0x0', gasLimit: '0x1c9c380', gasUsed: '0x5208',
          baseFeePerGas: '0x7', uncles: [], transactions: [], logsBloom: `0x${'0'.repeat(512)}`,
        };
      case 'eth_maxPriorityFeePerGas':
        return '0x3b9aca00';
      case 'eth_gasPrice':
        return '0x3b9aca00';
      default:
        return null;
    }
  };

  vi.stubGlobal('fetch', async (_url: unknown, init?: { body?: string }) => {
    const parsed = JSON.parse(init?.body ?? '[]') as Recorded | Recorded[];
    const batch = Array.isArray(parsed) ? parsed : [parsed];
    for (const m of batch) asked.push(m);
    const out = batch.map((m, i) => ({
      jsonrpc: '2.0', id: (m as unknown as { id?: number }).id ?? i, result: handle(m),
    }));
    return new Response(JSON.stringify(Array.isArray(parsed) ? out : out[0]), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  });

  return {
    asked,
    gasRequests: () => asked.filter((a) => a.method === 'eth_estimateGas'),
    restore: () => vi.unstubAllGlobals(),
  };
}

const adapter = () => new EvmAdapter(descriptor, [{ url: 'http://rpc.test' }]);

afterEach(() => vi.unstubAllGlobals());

describe('buildTransaction — a native transfer', () => {
  it('returns everything a device needs to sign: nonce, fee caps and gas', async () => {
    const node = serveNode();
    try {
      const tx = await adapter().buildTransaction({
        chainId: '1',
        from: ALICE,
        to: BOB,
        value: '1000000',
      });

      expect(tx).toMatchObject({
        to: BOB,
        value: '1000000',
        data: '0x',
        chainId: 1,
        gas: '21000',
        nonce: 7,
        maxPriorityFeePerGas: '1000000000',
      });
      // EIP-1559 ceiling: base fee 7 doubled plus the tip, as the node said.
      expect(tx.maxFeePerGas).toBe('1000000008');
      expect(node.gasRequests()).toHaveLength(1);
    } finally {
      node.restore();
    }
  });

  it('asks for no nonce when the sender is unknown', async () => {
    const node = serveNode();
    try {
      const tx = await adapter().buildTransaction({ chainId: '1', to: BOB, value: '1' });
      expect(tx.nonce).toBeUndefined();
      expect(node.asked.some((a) => a.method === 'eth_getTransactionCount')).toBe(false);
      expect(tx.maxFeePerGas).toBeDefined();
    } finally {
      node.restore();
    }
  });
});

describe('buildTransaction — an ERC-20 transfer', () => {
  it('moves no value and puts the amount in calldata against the token contract', async () => {
    const node = serveNode();
    try {
      const tx = await adapter().buildTransaction({
        chainId: '1',
        from: ALICE,
        to: BOB,
        token: TOKEN,
        amount: '1000000',
      });

      expect(tx.to).toBe(TOKEN);
      expect(tx.value).toBe('0');
      expect(tx.nonce).toBe(7);

      const decoded = decodeFunctionData({ abi: erc20Abi, data: tx.data as `0x${string}` });
      expect(decoded.functionName).toBe('transfer');
      // The address comes back checksummed — the comparison is that it is the
      // same account, not that it wears the same case.
      expect(String(decoded.args?.[0]).toLowerCase()).toBe(BOB);
      expect(decoded.args?.[1]).toBe(1_000_000n);

      // Gas must be estimated against the call actually being assembled —
      // a fee estimated on an empty transfer is a fee that lies.
      const [estimate] = node.gasRequests();
      const call = estimate?.params?.[0] as { to: string; value: string; data: string };
      expect(call.to).toBe(TOKEN);
      // Quantities go over JSON-RPC as hex, so zero is `0x0`.
      expect(call.value).toBe('0x0');
      expect(call.data).toBe(tx.data);
      expect(tx.gas).toBe('50000');
    } finally {
      node.restore();
    }
  });

  it('refuses an amount that is not a positive integer of base units', async () => {
    serveNode();
    await expect(
      adapter().buildTransaction({
        chainId: '1', from: ALICE, to: BOB, token: TOKEN, amount: '1.5',
      }),
    ).rejects.toThrow();
  });
});
