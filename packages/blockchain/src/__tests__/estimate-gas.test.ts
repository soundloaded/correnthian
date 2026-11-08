import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodeFunctionData, erc20Abi, toHex, type Hex } from 'viem';
import type { ChainDescriptor } from '../adapter.js';
import { EvmAdapter } from '../evm.js';
import { RpcReverted } from '../rpc.js';

/**
 * `estimateGas` is a reply from the node, including when the call reverts.
 *
 * A revert must not quarantine the endpoint and must not be repeated on the
 * next URL: every node reverts the same call. When the caller names an
 * approve that is not on the chain yet, the swap is estimated against state
 * that already includes that allowance. SwapRouter02 pulls the token with
 * `transferFrom`, and the approve is still unsigned.
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

const A = 'http://rpc-a.test';
const B = 'http://rpc-b.test';
const OWNER = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SPENDER = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const TOKEN = '0xcccccccccccccccccccccccccccccccccccccccc';
const AMOUNT = 1_000_000n;

const block = {
  number: '0x64',
  hash: `0x${'b'.repeat(64)}`,
  parentHash: `0x${'c'.repeat(64)}`,
  timestamp: '0x0',
  transactionsRoot: `0x${'0'.repeat(64)}`,
  stateRoot: `0x${'0'.repeat(64)}`,
  receiptsRoot: `0x${'0'.repeat(64)}`,
  miner: `0x${'0'.repeat(40)}`,
  difficulty: '0x0',
  totalDifficulty: '0x0',
  extraData: '0x',
  size: '0x0',
  gasLimit: '0x1c9c380',
  gasUsed: '0x5208',
  baseFeePerGas: '0x7',
  uncles: [],
  transactions: [],
  logsBloom: `0x${'0'.repeat(512)}`,
};

interface Recorded {
  method: string;
  params?: unknown[];
}

const state = {
  plan: {} as Record<string, 'revert' | 'down' | 'ok'>,
  calls: [] as string[],
  asked: [] as Recorded[],
};

function resultFor(method: string, params?: unknown[]): unknown {
  switch (method) {
    case 'eth_chainId':
      return '0x1';
    case 'eth_call': {
      const override = params?.[2] as
        | Record<string, { stateDiff?: Record<string, string> }>
        | undefined;
      const diff = override && Object.values(override)[0]?.stateDiff;
      const word = diff && Object.values(diff)[0];
      return word ?? '0x0';
    }
    case 'eth_estimateGas':
      return '0xc350';
    case 'eth_getTransactionCount':
      return '0x7';
    case 'eth_getBlockByNumber':
      return block;
    case 'eth_maxPriorityFeePerGas':
    case 'eth_gasPrice':
      return '0x3b9aca00';
    default:
      return null;
  }
}

function installFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: unknown, init?: { body?: string }) => {
      const target = String(url).replace(/\/$/, '');
      const parsed = JSON.parse(init?.body ?? '{}') as Recorded | Recorded[];
      const batch = Array.isArray(parsed) ? parsed : [parsed];
      state.calls.push(target);
      for (const item of batch) state.asked.push(item);

      const key = target === A ? 'a' : 'b';
      const reply = state.plan[key] ?? 'ok';
      if (reply === 'down') throw new TypeError('fetch failed');

      const out = batch.map((item, index) => {
        const id = (item as { id?: number }).id ?? index;
        if (reply === 'revert' && item.method === 'eth_estimateGas') {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: 3, message: 'execution reverted', data: '0x' },
          };
        }
        return { jsonrpc: '2.0', id, result: resultFor(item.method, item.params) };
      });
      return new Response(JSON.stringify(Array.isArray(parsed) ? out : out[0]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
}

function adapter() {
  return new EvmAdapter(descriptor, [
    { url: A, weight: 0 },
    { url: B, weight: 1 },
  ]);
}

afterEach(() => {
  vi.unstubAllGlobals();
  state.plan = {};
  state.calls = [];
  state.asked = [];
});

describe('estimateGas revert', () => {
  it('does not quarantine the endpoint and does not call the second URL', async () => {
    installFetch();
    state.plan = { a: 'revert', b: 'ok' };

    const built = adapter();
    await expect(
      built.buildTransaction({ chainId: '1', from: OWNER, to: SPENDER, value: '1' }),
    ).rejects.toBeInstanceOf(RpcReverted);
    expect(state.calls.length).toBeGreaterThan(0);
    expect(state.calls.every((url) => url === A)).toBe(true);
    expect(built.endpointFailures).toEqual([]);

    state.calls = [];
    await expect(
      built.buildTransaction({ chainId: '1', from: OWNER, to: SPENDER, value: '1' }),
    ).rejects.toBeInstanceOf(RpcReverted);
    expect(state.calls.every((url) => url === A)).toBe(true);
    expect(built.endpointFailures).toEqual([]);
  });

  it('quarantines and fails over when the endpoint cannot be reached', async () => {
    installFetch();
    state.plan = { a: 'down', b: 'ok' };

    const built = adapter();
    await expect(
      built.buildTransaction({ chainId: '1', from: OWNER, to: SPENDER, value: '1' }),
    ).resolves.toMatchObject({ nonce: 7 });
    expect(state.calls).toContain(A);
    expect(state.calls).toContain(B);
    expect(built.endpointFailures.map((failure) => failure.url)).toEqual([A]);
  });
});

describe('estimateGas sees an unsigned approve', () => {
  it('overrides the token allowance with the approved amount', async () => {
    installFetch();
    state.plan = { a: 'ok' };

    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [SPENDER, AMOUNT],
    });
    await adapter().buildTransaction({
      chainId: '1',
      from: OWNER,
      to: SPENDER,
      value: '0',
      data: '0xdead',
      priorCalls: [{ to: TOKEN, data, value: '0' }],
    });

    const probes = state.asked.filter((item) => item.method === 'eth_call');
    const estimates = state.asked.filter((item) => item.method === 'eth_estimateGas');
    expect(probes.length).toBeGreaterThan(0);
    expect(estimates).toHaveLength(1);

    const override = estimates[0]?.params?.[2] as
      | Record<string, { stateDiff?: Record<string, Hex> }>
      | undefined;
    const account = override && Object.entries(override).find(
      ([address]) => address.toLowerCase() === TOKEN,
    )?.[1];
    expect(Object.values(account?.stateDiff ?? {})).toContain(toHex(AMOUNT, { size: 32 }));
  });
});
