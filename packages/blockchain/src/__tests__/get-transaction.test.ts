import { afterEach, describe, expect, it, vi } from 'vitest';
import { EvmAdapter } from '../evm.js';
import { RpcPool } from '../rpc.js';
import type { ChainDescriptor } from '../adapter.js';

/**
 * `getTransaction` — DEF-020.
 *
 * The defect was one of *layering*, not of message text: a node answering
 * "I do not have this transaction" and a node failing to answer at all both
 * emerged from `RpcPool.withFailover` as `All N RPC endpoint(s) failed for
 * this read. Drop detection cannot be built on that, because it would set
 * `droppedAt` on live transactions during any outage.
 *
 * So the assertions below are about **which endpoints were asked and whether
 * they were condemned**, not only about what came back. A test that only
 * checked the return value would pass for a fix that quarantined the healthy
 * node on the way out.
 */

const descriptor: ChainDescriptor = {
  chainId: '1', family: 'evm', nativeSymbol: 'ETH', decimals: 18,
  explorerUrl: null, enabled: true, isTestnet: false,
};

const HASH = `0x${'a'.repeat(64)}`;
const OTHER = `0x${'b'.repeat(64)}`;
const REVERTED = `0x${'c'.repeat(64)}`;
const PENDING = `0x${'d'.repeat(64)}`;
const A = 'http://rpc-a.test';
const B = 'http://rpc-b.test';

interface Behaviour {
  /** `absent` — the node does not have it. `record` — it does. `down` — the node errors. */
  kind: 'absent' | 'record' | 'down';
  /** `null` means in the mempool; absent means the field was not supplied. */
  blockNumber?: string | null;
  receipt?: 'success' | 'reverted';
}

type Plan = Record<string, Behaviour>;

const state = {
  plan: {} as Plan,
  calls: [] as Array<{ url: string; method: string }>,
};

function installFetch() {
  const fetchMock = vi.fn(async (url: unknown, init?: { body?: string }) => {
    // `viem`'s http transport normalises to a trailing slash, so endpoints
    // are compared on the normalised form rather than the one configured.
    const target = String(url).replace(/\/$/, '');
    const body = JSON.parse(init?.body ?? '{}') as {
      id: number;
      method: string;
      params?: [string];
    };
    state.calls.push({ url: target, method: body.method });

    // Which endpoint is being asked decides the answer. `rpc-a` is asked first.
    const key = target === A ? 'a' : 'b';
    const hash = body.params?.[0] ?? '';
    const behaviour: Behaviour =
      state.plan[`${key}:${hash}`] ?? state.plan[`${key}:*`] ?? { kind: 'absent' };

    if (behaviour.kind === 'down') {
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0', id: body.id,
          error: { code: -32603, message: 'internal error' },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }

    if (body.method === 'eth_getTransactionByHash') {
      if (behaviour.kind === 'absent') {
        // A node's normal answer for something it does not hold.
        return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: null }), {
          status: 200, headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({
        jsonrpc: '2.0', id: body.id,
        result: {
          hash, blockNumber: behaviour.blockNumber ?? null,
          blockHash: `0x${'e'.repeat(64)}`, from: '0x' + 'f'.repeat(40),
          to: '0x' + '1'.repeat(40), value: '0x1', nonce: '0x1', input: '0x',
          gas: '0x5208', gasPrice: '0x3b9aca00', type: '0x0', chainId: '0x1',
          accessList: [], transactionIndex: '0x0', v: '0x0', r: '0x0', s: '0x0',
        },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    if (body.method === 'eth_getTransactionReceipt') {
      return new Response(JSON.stringify({
        jsonrpc: '2.0', id: body.id,
        result: {
          transactionHash: hash, transactionIndex: '0x0',
          blockHash: `0x${'e'.repeat(64)}`, blockNumber: behaviour.blockNumber ?? '0x64',
          from: '0x' + 'f'.repeat(40), to: '0x' + '1'.repeat(40),
          cumulativeGasUsed: '0x5208', gasUsed: '0x5208', contractAddress: null,
          logs: [], logsBloom: '0x' + '0'.repeat(512),
          status: behaviour.receipt === 'reverted' ? '0x0' : '0x1',
          type: '0x0', effectiveGasPrice: '0x3b9aca00',
        },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: null }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function adapter() {
  return new EvmAdapter(descriptor, [{ url: A, weight: 0 }, { url: B, weight: 1 }]);
}

const callsTo = (url: string) => state.calls.filter((c) => c.url === url).map((c) => c.method);

beforeEachReset();
function beforeEachReset() {
  // `beforeEach` is imported per describe below; reset happens in afterEach.
}

afterEach(() => {
  vi.unstubAllGlobals();
  state.plan = {};
  state.calls = [];
});

describe('DEF-020 — absence is an answer, not an outage', () => {
  it('resolves null when no endpoint has the transaction', async () => {
    installFetch();
    state.plan = { [`a:${HASH}`]: { kind: 'absent' }, [`b:${HASH}`]: { kind: 'absent' } };

    const out = await adapter().getTransaction(HASH);

    expect(out).toBeNull();
    // Both were asked. A single node's silence is not proof of absence.
    expect(callsTo(A).filter((m) => m === 'eth_getTransactionByHash')).toHaveLength(1);
    expect(callsTo(B).filter((m) => m === 'eth_getTransactionByHash')).toHaveLength(1);
  });

  it('does not quarantine the endpoint that correctly said it does not have it', async () => {
    installFetch();
    state.plan = {
      [`a:${HASH}`]: { kind: 'absent' },
      [`b:${HASH}`]: { kind: 'absent' },
      // The next lookup: if A had been quarantined it would not be asked.
      [`a:${OTHER}`]: { kind: 'record', blockNumber: '0x64', receipt: 'success' },
      [`b:${OTHER}`]: { kind: 'record', blockNumber: '0x64', receipt: 'success' },
    };

    const a = adapter();
    await a.getTransaction(HASH);
    state.calls = [];
    const out = await a.getTransaction(OTHER);

    expect(out?.status).toBe('confirmed');
    expect(callsTo(A)).toContain('eth_getTransactionByHash');
  });

  it('trusts the second endpoint when the first does not have it', async () => {
    installFetch();
    state.plan = {
      [`a:${HASH}`]: { kind: 'absent' },
      [`b:${HASH}`]: { kind: 'record', blockNumber: '0x64', receipt: 'success' },
    };

    const out = await adapter().getTransaction(HASH);

    expect(out).toMatchObject({ hash: HASH, status: 'confirmed', blockNumber: 0x64n });
    expect(callsTo(A)).toContain('eth_getTransactionByHash');
    expect(callsTo(B)).toContain('eth_getTransactionByHash');
  });

  it('quarantines an endpoint that actually failed — the distinction that was missing', async () => {
    installFetch();
    state.plan = {
      [`a:${HASH}`]: { kind: 'down' },
      [`b:${HASH}`]: { kind: 'record', blockNumber: '0x64', receipt: 'success' },
      [`a:${OTHER}`]: { kind: 'record', blockNumber: '0x64', receipt: 'success' },
    };

    // One adapter: the quarantine lives on its `RpcPool`, which is
    // per-instance. A fresh adapter per call would have hidden the defect
    // this is checking for just as easily as it hides the fix.
    const a = adapter();
    await a.getTransaction(HASH);
    state.calls = [];
    await a.getTransaction(OTHER);

    // A failed this time round; B did. A is quarantined for 30s, so only B
    // is asked — which is exactly what must NOT happen after an absence.
    expect(callsTo(A)).toHaveLength(0);
    expect(callsTo(B)).toContain('eth_getTransactionByHash');
  });

  it('still reports a genuine outage as one', async () => {
    installFetch();
    state.plan = {
      [`a:${HASH}`]: { kind: 'down' },
      [`b:${HASH}`]: { kind: 'down' },
    };

    await expect(adapter().getTransaction(HASH)).rejects.toThrow(
      /All 2 RPC endpoint\(s\) failed for this read/,
    );
  });
});

describe('status is reported from the receipt, not assumed from inclusion', () => {
  it('is pending while there is no block, and asks for no receipt', async () => {
    installFetch();
    state.plan = { [`a:${PENDING}`]: { kind: 'record', blockNumber: null } };

    const out = await adapter().getTransaction(PENDING);

    expect(out).toMatchObject({ status: 'pending', blockNumber: null });
    expect(state.calls.some((c) => c.method === 'eth_getTransactionReceipt')).toBe(false);
  });

  it('is failed when the receipt reports a revert', async () => {
    installFetch();
    state.plan = {
      [`a:${REVERTED}`]: { kind: 'record', blockNumber: '0x64', receipt: 'reverted' },
    };

    const out = await adapter().getTransaction(REVERTED);

    // Mined is not succeeded. A reverted send reported as confirmed would tell
    // an account holder their money moved.
    expect(out?.status).toBe('failed');
    expect(out?.blockNumber).toBe(0x64n);
  });

  it('carries no confirmation count — the adapter does not know the head', async () => {
    installFetch();
    state.plan = { [`a:${HASH}`]: { kind: 'record', blockNumber: '0x64', receipt: 'success' } };

    const out = await adapter().getTransaction(HASH);
    // `confirmations` used to be declared and hard-coded to 0, which reads as
    // a measurement of zero. It is gone rather than filled in.
    expect(Object.keys(out ?? {})).toEqual(
      expect.arrayContaining(['hash', 'status', 'blockNumber', 'from', 'to', 'valueRaw']),
    );
    expect(Object.keys(out ?? {})).not.toContain('confirmations');
    expect(Object.keys(out ?? {})).not.toContain('blockTime');
  });
});

describe('RpcPool treats RpcAbsent as a reply', () => {
  it('does not record a failure for an absent answer', async () => {
    const pool = new RpcPool([{ url: A }, { url: B }]);
    await expect(
      pool.withFailover(async () => {
        const { RpcAbsent } = await import('../rpc.js');
        throw new RpcAbsent('the transaction');
      }),
    ).rejects.toThrow(/No endpoint has the transaction/);
    expect(pool.recentFailures).toHaveLength(0);
  });

  it('records and quarantines a real failure', async () => {
    const pool = new RpcPool([{ url: A }, { url: B }]);
    await expect(
      pool.withFailover(async () => {
        throw new Error('connection reset');
      }),
    ).rejects.toThrow(/All 2 RPC endpoint\(s\) failed/);
    expect(pool.recentFailures).toHaveLength(2);
    expect(pool.recentFailures[0]?.error).toBe('connection reset');
  });
});
