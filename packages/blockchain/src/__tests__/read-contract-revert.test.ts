import { afterEach, describe, expect, it, vi } from 'vitest';
import { EvmAdapter } from '../evm.js';
import { RpcReverted } from '../rpc.js';
import type { ChainDescriptor } from '../adapter.js';

/**
 * A QuoterV2 miss is an `eth_call` revert from a node that answered. That
 * reply must not quarantine the endpoint and must not be repeated on the
 * next URL: every node reverts the same missing fee tier. A transport
 * failure is the opposite — the node did not answer — and keeps the pool's
 * failover and 30-second quarantine.
 */

const descriptor: ChainDescriptor = {
  chainId: '1', family: 'evm', nativeSymbol: 'ETH', decimals: 18,
  explorerUrl: null, enabled: true, isTestnet: false,
};

const A = 'http://rpc-a.test';
const B = 'http://rpc-b.test';
const CONTRACT = `0x${'c'.repeat(40)}` as `0x${string}`;
const AMOUNT = 50n;
const AMOUNT_HEX = `0x${AMOUNT.toString(16).padStart(64, '0')}`;

const abi = [
  {
    type: 'function',
    name: 'amount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'amount', type: 'uint256' }],
  },
] as const;

type Reply = 'revert' | 'down' | 'ok';

const state = {
  plan: {} as Record<string, Reply>,
  calls: [] as string[],
};

function installFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: unknown, init?: { body?: string }) => {
      const target = String(url).replace(/\/$/, '');
      const body = JSON.parse(init?.body ?? '{}') as { id: number; method: string };
      state.calls.push(target);

      const key = target === A ? 'a' : 'b';
      const reply = state.plan[key] ?? 'ok';

      if (reply === 'down') {
        throw new TypeError('fetch failed');
      }

      if (reply === 'revert') {
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            error: { code: 3, message: 'execution reverted', data: '0x' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }

      return new Response(
        JSON.stringify({ jsonrpc: '2.0', id: body.id, result: AMOUNT_HEX }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }),
  );
}

function adapter() {
  return new EvmAdapter(descriptor, [{ url: A, weight: 0 }, { url: B, weight: 1 }]);
}

function read(a: EvmAdapter) {
  return a.readContract({ address: CONTRACT, abi, functionName: 'amount' });
}

afterEach(() => {
  vi.unstubAllGlobals();
  state.plan = {};
  state.calls = [];
});

describe('a contract revert is a reply, not an outage', () => {
  it('does not quarantine the endpoint and does not call the second URL', async () => {
    installFetch();
    state.plan = { a: 'revert', b: 'ok' };

    const a = adapter();
    await expect(read(a)).rejects.toBeInstanceOf(RpcReverted);
    expect(state.calls).toEqual([A]);
    expect(a.endpointFailures).toEqual([]);

    state.calls = [];
    await expect(read(a)).rejects.toBeInstanceOf(RpcReverted);
    expect(state.calls).toEqual([A]);
    expect(a.endpointFailures).toEqual([]);
  });

  it('quarantines and fails over when the endpoint cannot be reached', async () => {
    installFetch();
    state.plan = { a: 'down', b: 'ok' };

    const a = adapter();
    await expect(read(a)).resolves.toBe(AMOUNT);
    expect(state.calls).toContain(A);
    expect(state.calls).toContain(B);
    expect(a.endpointFailures.map((f) => f.url)).toEqual([A]);

    state.calls = [];
    await expect(read(a)).resolves.toBe(AMOUNT);
    expect(state.calls).not.toContain(A);
    expect(state.calls).toContain(B);
  });
});
