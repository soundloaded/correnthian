import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assertReason } from '../audit/audit.service.js';
import { isOperatorRole, rankOf, roleSatisfies } from '../common/roles.js';
import type { Transaction } from '../generated/prisma/client.js';
import { TransactionsService, type TransactionActor } from './transactions.service.js';
import { settingDefinition } from '../settings/registry.js';

/**
 * A transaction store with a real compare-and-swap.
 *
 * Mocking `updateMany` with `vi.fn().mockResolvedValue({ count: 1 })` would
 * make the concurrency tests pass without testing anything — the property
 * under test is that the expected state is part of the `where` clause, and a
 * stub cannot fail. This fake applies that clause for real, so "two operators
 * race" is a race rather than a script.
 */
type Row = Record<string, unknown>;

function makeStore(initial: Row[]) {
  const rows = new Map(initial.map((r) => [r.id as string, { ...r }]));
  const written: Array<{ where: Row; data: Row }> = [];

  const prisma = {
    transaction: {
      findUnique: async ({ where }: { where: { id?: string; chainId_txHash?: { chainId: string; txHash: string } } }) => {
        if (where.chainId_txHash) {
          const key = where.chainId_txHash;
          const found = [...rows.values()].find(
            (r) => r['chainId'] === key.chainId && r['txHash'] === key.txHash,
          );
          return found ? ({ ...found } as unknown as Transaction) : null;
        }
        const row = rows.get(where.id as string);
        return row ? ({ ...row } as unknown as Transaction) : null;
      },
      findMany: async (args?: { where?: { state?: { in?: string[] }; expiresAt?: { lt?: Date }; createdAt?: { gte?: Date } } }) => {
        let out = [...rows.values()];
        const states = args?.where?.state?.in;
        if (states) out = out.filter((r) => states.includes(r['state'] as string));
        const before = args?.where?.expiresAt?.lt;
        if (before) out = out.filter((r) => (r['expiresAt'] as Date) < before);
        // The daily chart's window. A fake that ignored the bound would let
        // an old row into the series and the test would pass anyway.
        const since = args?.where?.createdAt?.gte;
        if (since) out = out.filter((r) => (r['createdAt'] as Date) >= since);
        return out;
      },
      count: async () => rows.size,
      groupBy: async () => [],
      create: async ({ data }: { data: Row }) => {
        // The real unique index. `recordObserved` relies on it for idempotency,
        // and a stub that accepted any hash would let a second row through.
        if (data.txHash) {
          const clash = [...rows.values()].find(
            (r) => r['chainId'] === data.chainId && r['txHash'] === data.txHash,
          );
          if (clash) {
            const err = new Error('Unique constraint failed on (chainId, txHash)');
            (err as unknown as { code: string }).code = 'P2002';
            throw err;
          }
        }
        const row = { txHash: null, createdAt: new Date(), ...data, id: `tx${rows.size + 1}` };
        rows.set(row.id as string, row);
        return { ...row };
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = rows.get(where.id);
        if (!row) throw new Error('record not found');
        for (const [key, value] of Object.entries(data)) row[key] = value;
        row.updatedAt = new Date();
        return { ...row };
      },
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        written.push({ where, data });
        const row = rows.get(where['id'] as string);
        if (!row) return { count: 0 };
        // The clause that makes concurrent updates safe.
        if (row['state'] !== where['state']) return { count: 0 };
        for (const [key, value] of Object.entries(data)) {
          const increment =
            value && typeof value === 'object' && 'increment' in (value as Row)
              ? (value as { increment: number }).increment
              : null;
          row[key] = increment === null ? value : ((row[key] as number) ?? 0) + increment;
        }
        return { count: 1 };
      },
    },
    wallet: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === 'w1'
          ? {
              id: 'w1',
              userId: 'u1',
              address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
              chainId: '1',
              chain: { id: '1', family: 'evm', enabled: true, nativeSymbol: 'ETH' },
            }
          : null,
    },
    asset: {
      findUnique: async ({ where }: { where: { assetId?: string; id?: string } }) =>
        // Two keys, two callers: the registry is read by the derived
        // `assetId`, and a `Transaction.assetId` foreign key by row id.
        where.id === 'a1'
          ? { id: 'a1', assetId: '1:0xgold:c1', symbol: 'XAU', chainId: '1', contractAddress: '0xgold', enabled: true, transferSupported: true }
          : where.id === 'native1'
            ? { id: 'native1', assetId: '1:native:c1', symbol: 'ETH', chainId: '1', contractAddress: '', enabled: true, transferSupported: true }
            : where.assetId === '1:0xgold:c1'
          ? { id: 'a1', assetId: '1:0xgold:c1', symbol: 'XAU', chainId: '1', contractAddress: '0xgold', enabled: true, transferSupported: true }
          : where.assetId === '8453:0xgold:c1'
            ? { id: 'a2', assetId: '8453:0xgold:c1', symbol: 'XAU', chainId: '8453', contractAddress: '0xgold', enabled: true, transferSupported: true }
            : where.assetId === '1:native:c1'
              ? { id: 'native1', assetId: '1:native:c1', symbol: 'ETH', chainId: '1', contractAddress: '', enabled: true, transferSupported: true }
              : null,
    },
    provider: { findUnique: async () => ({ id: 'p1', slug: 'placeholder-metals' }) },
  };

  return { prisma, rows, written };
}

const tx = (over: Row = {}): Row => ({
  id: 'tx1',
  userId: 'u1',
  walletId: 'w1',
  assetId: 'a1',
  chainId: '1',
  providerId: null,
  txHash: null,
  destination: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  direction: 'out',
  state: 'created',
  amountRaw: '100000000',
  amountUsd: null,
  feeRaw: null,
  feeUsd: null,
  confirmations: 0,
  requiredConfirmations: 12,
  droppedAt: null,
  dropCount: 0,
  lastSeenAt: null,
  errorCode: null,
  errorMessage: null,
  blockNumber: null,
  blockTime: null,
  metadata: null,
  expiresAt: new Date(Date.now() + 60_000),
  signedAt: null,
  broadcastAt: null,
  confirmedAt: null,
  failedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

const OWNER: TransactionActor = { id: 'u1', role: 'user' };
const OTHER: TransactionActor = { id: 'u2', role: 'user' };
const SUPPORT: TransactionActor = { id: 's1', role: 'support' };

/**
 * The settings the service reads. The fake serves the declared default for
 * every key, so this suite exercises the service at the values the platform
 * ships with.
 */
const settings = {
  get: async (key: string) => settingDefinition(key)!.default,
} as never;

describe('TransactionsService — the lifecycle', () => {
  let svc: TransactionsService;
  let store: ReturnType<typeof makeStore>;
  let audit: {
    record: ReturnType<typeof vi.fn>;
    recordChange: ReturnType<typeof vi.fn>;
    assertReason: typeof assertReason;
  };
  /**
   * What `BlockchainService.forChain` hands out this test — the assembly
   * and relay side of BE-602. Reset in `seed`; each test replaces the
   * methods it cares about.
   */
  let adapter: {
    assemblePayload: ReturnType<typeof vi.fn>;
    buildTransaction: ReturnType<typeof vi.fn>;
    broadcastTransaction: ReturnType<typeof vi.fn>;
    decodeSignedTransaction: ReturnType<typeof vi.fn>;
  };
  let blockchain: { forChain: ReturnType<typeof vi.fn> };
  let row: Row;

  const seed = (over: Row = {}) => {
    row = tx(over);
    store = makeStore([row]);
    audit = {
      record: vi.fn().mockResolvedValue(undefined),
      recordChange: vi.fn().mockResolvedValue({ before: {}, after: {}, changed: ['state'] }),
      // The real one, not a stub: "a reason is required" is the property
      // under test and a `vi.fn()` would assert nothing.
      assertReason,
    };
    adapter = {
      // The pure half of assembly: what the payload must say, with no RPC.
      // The relay path re-derives it to compare against what was signed.
      assemblePayload: vi.fn((req: { to: string; value?: string; token?: string }) =>
        req.token
          ? { to: req.token, value: '0', data: '0xa9059cbb' }
          : { to: req.to, value: req.value ?? '0', data: '0x' },
      ),
      buildTransaction: vi.fn(async () => ({
        to: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        value: '0',
        data: '0xa9059cbb',
        chainId: 1,
        gas: '21000',
        nonce: 3,
        maxFeePerGas: '2000000000',
        maxPriorityFeePerGas: '100000000',
      })),
      broadcastTransaction: vi.fn(async () => '0x' + 'c'.repeat(64)),
      decodeSignedTransaction: vi.fn(async () => ({
        chainId: 1,
        from: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        // A signed token transfer points at the *contract*, not the payee.
        to: '0xgold',
        value: '0',
        nonce: 3,
        data: '0xa9059cbb',
      })),
    };
    blockchain = { forChain: vi.fn(async () => adapter) };
    svc = new TransactionsService(store.prisma as never, audit as never, blockchain as never, settings);
  };

  beforeEach(() => seed());

  describe('transitions that skip a control are refused', () => {
    it('refuses created → broadcast: nothing authorised it', async () => {
      await expect(svc.transition('tx1', 'broadcast', OWNER, { to: 'broadcast', txHash: '0x' + 'a'.repeat(64) }))
        .rejects.toThrow(/from "created" to "broadcast"/);
      expect(store.rows.get('tx1')?.['state']).toBe('created');
    });

    it('refuses signed → confirmed: nothing has been broadcast', async () => {
      seed({ state: 'signed' });
      await expect(svc.transition('tx1', 'confirmed', SUPPORT, { to: 'confirmed' }))
        .rejects.toThrow(/from "signed" to "confirmed"/);
    });

    it('refuses created → confirmed outright', async () => {
      await expect(svc.transition('tx1', 'confirmed', SUPPORT, { to: 'confirmed' }))
        .rejects.toThrow(/Permitted from "created"/);
    });

    it('names the edges that do exist, so the refusal is actionable', async () => {
      await expect(svc.transition('tx1', 'pending', SUPPORT, { to: 'pending' }))
        .rejects.toThrow(/Permitted from "created": signed, failed, cancelled, expired/);
    });

    it('audits the refusal, because two operators disagreeing is the thing to investigate', async () => {
      await expect(svc.transition('tx1', 'pending', SUPPORT, { to: 'pending' })).rejects.toThrow();
      const entry = audit.record.mock.calls.at(-1)?.[0];
      expect(entry).toMatchObject({
        action: 'transaction.transition.rejected.pending',
        outcome: 'failure',
        before: { state: 'created' },
        after: { state: 'pending' },
      });
    });

    it('never treats a terminal state as a starting point', async () => {
      seed({ state: 'failed' });
      for (const to of ['pending', 'confirmed', 'signed', 'broadcast'] as const) {
        await expect(svc.transition('tx1', to, SUPPORT, { to })).rejects.toThrow(/it is final/);
      }
    });
  });

  describe('who is allowed to assert a state', () => {
    it('lets the owner report that their own device signed', async () => {
      await svc.markSigned('tx1', OWNER);
      expect(store.rows.get('tx1')?.['state']).toBe('signed');
      expect(store.rows.get('tx1')?.['signedAt']).toBeInstanceOf(Date);
    });

    it("another account learns nothing, not even that the row exists", async () => {
      // 404, not the 403 below: the entitlement messages name edges and
      // roles, which is guidance for a caller with a legitimate row — not
      // for a stranger, who gets nothing to probe with.
      await expect(svc.markSigned('tx1', OTHER)).rejects.toThrow(/not found/i);
      expect(store.rows.get('tx1')?.['state']).toBe('created');
    });

    it('lets an operator report a chain state the owner cannot know', async () => {
      seed({ state: 'broadcast', txHash: '0x' + 'a'.repeat(64) });
      await svc.transition('tx1', 'pending', SUPPORT, { to: 'pending' });
      expect(store.rows.get('tx1')?.['state']).toBe('pending');
    });

    it('refuses the owner before it says anything about the state machine', async () => {
      // Entitlement is checked first on purpose: an unentitled caller learns
      // nothing about which edges exist.
      await expect(svc.transition('tx1', 'pending', OWNER, { to: 'pending' }))
        .rejects.toThrow(/requires support/);
    });

    it('refuses the owner reporting a chain state — "mine failed" is self-assessment', async () => {
      await expect(svc.transition('tx1', 'failed', OWNER, { to: 'failed' }))
        .rejects.toThrow(/requires support/);
    });

    it('refuses `created` as a transition target outright', async () => {
      await expect(svc.transition('tx1', 'created', SUPPORT, { to: 'created' }))
        .rejects.toThrow(/only reachable by creating/);
    });

    it('refuses `created` as a target for anyone, scheduler included', async () => {
      await expect(
        svc.transition('tx1', 'created', { id: 'system', role: 'system' }, { to: 'created' }),
      ).rejects.toThrow(/only reachable by creating/);
    });
  });

  describe('idempotence', () => {
    it('treats a re-applied state as a no-op, not an error and not a write', async () => {
      seed({ state: 'pending' });
      const before = store.written.length;
      const result = await svc.transition('tx1', 'pending', SUPPORT, { to: 'pending' });
      expect(result.state).toBe('pending');
      expect(store.written.length).toBe(before);
      expect(audit.recordChange).not.toHaveBeenCalled();
    });
  });

  describe('broadcast, and refusing to unsay it', () => {
    beforeEach(async () => {
      seed();
      await svc.markSigned('tx1', OWNER);
    });

    it('requires a hash to broadcast', async () => {
      await expect(svc.reportBroadcast('tx1', OWNER, { to: 'broadcast' }))
        .rejects.toThrow(/needs the transaction hash/);
    });

    it('accepts the hash and records the broadcast', async () => {
      const hash = '0x' + 'b'.repeat(64);
      await svc.reportBroadcast('tx1', OWNER, { to: 'broadcast', txHash: hash });
      expect(store.rows.get('tx1')).toMatchObject({ state: 'broadcast', txHash: hash });
    });

    it('refuses to cancel or expire something already on the network', async () => {
      const hash = '0x' + 'b'.repeat(64);
      await svc.reportBroadcast('tx1', OWNER, { to: 'broadcast', txHash: hash });
      await expect(svc.transition('tx1', 'cancelled', OWNER, { to: 'cancelled' }))
        .rejects.toThrow(/from "broadcast" to "cancelled"/);
      await expect(svc.transition('tx1', 'expired', SUPPORT, { to: 'expired' }))
        .rejects.toThrow(/from "broadcast" to "expired"/);
    });
  });

  describe('recording what the chain reports', () => {
    const AT = new Date('2026-10-08T12:00:00.000Z');
    const HASH = '0x' + 'f'.repeat(64);

    beforeEach(() => seed({ state: 'broadcast', txHash: HASH }));

    it('lets the scheduler observe chain state', async () => {
      // `assertEntitled` has always accepted `system`; `assertOperator` did
      // not, so `observe` — the only method that moves a row with depth —
      // rejected the one caller that exists to call it. Nothing scheduled
      // called `observe` until the indexer landed, which is why it went
      // unnoticed.
      const after = await svc.observe(
        'tx1',
        { id: 'system', role: 'system' },
        { txHash: HASH, confirmations: 3, outcome: 'seen' },
        AT,
      );

      expect(after.state).toBe('pending');
      expect(after.confirmations).toBe(3);
    });

    it('keeps "system" out of the role hierarchy, which is what makes trusting it safe', () => {
      // Both `assertEntitled` and `assertOperator` accept `role === 'system'`
      // on the strength of one property: no session can present it. That is
      // not enforced here, it is enforced by `system` being absent from
      // `ROLE_RANK` — it ranks below `user`, satisfies nothing, and `UserRole`
      // has no such value to store. Drop that and the shortcut above becomes
      // a privilege any account could claim.
      expect(rankOf('system')).toBe(-1);
      expect(roleSatisfies('system', 'support')).toBe(false);
      expect(isOperatorRole('system')).toBe(false);
    });

    it('records an inbound transfer already deep enough as confirmed', async () => {
      const created = await svc.recordObserved(
        {
          walletId: 'w1',
          assetKey: '1:0xgold:c1',
          txHash: '0x' + '9'.repeat(64),
          direction: 'in',
          amountRaw: '500',
          blockNumber: 100n,
          confirmations: 12,
          metadata: { logIndex: 4 },
        },
        AT,
      );

      expect(created.created).toBe(true);
      expect(store.rows.get(created.id)).toMatchObject({
        state: 'confirmed',
        direction: 'in',
        txHash: '0x' + '9'.repeat(64),
        confirmations: 12,
        requiredConfirmations: 12,
        walletId: 'w1',
        userId: 'u1',
        assetId: 'a1',
        amountRaw: '500',
      });
      // No intent was filed, so there is nothing for the expiry sweep to end.
      expect(store.rows.get(created.id)?.['expiresAt']).toBeUndefined();
    });

    it('refuses an asset registered on a different chain', async () => {
      await expect(
        svc.recordObserved({
          walletId: 'w1',
          assetKey: '8453:0xgold:c1',
          txHash: '0x' + '8'.repeat(64),
          direction: 'in',
          amountRaw: '500',
          blockNumber: 100n,
          confirmations: 12,
        }),
      ).rejects.toThrow(/on chain 8453, not 1/);
    });

    it('refuses a zero or malformed amount', async () => {
      await expect(
        svc.recordObserved({
          walletId: 'w1',
          assetKey: '1:0xgold:c1',
          txHash: '0x' + '7'.repeat(64),
          direction: 'in',
          amountRaw: '0',
          blockNumber: 100n,
          confirmations: 12,
        }),
      ).rejects.toThrow(/positive decimal string/);
    });
  });

  // --- BE-602: the server assembles, the device signs ---------------------

  describe('assembling an unsigned send', () => {
    it('assembles a token transfer against the token contract and records the fee it was shown', async () => {
      seed();
      const out = await svc.assemble('tx1', 'u1');

      expect(adapter.buildTransaction).toHaveBeenCalledTimes(1);
      const request = adapter.buildTransaction.mock.calls[0]?.[0];
      expect(request).toMatchObject({
        chainId: '1',
        from: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        to: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        token: '0xgold',
        amount: '100000000',
      });

      // Nothing is signed by assembling: the row stays exactly where it was.
      const row = store.rows.get('tx1');
      expect(row?.['state']).toBe('created');
      expect(out).toMatchObject({
        id: 'tx1',
        state: 'created',
        walletAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        fee: { raw: '42000000000000', nativeSymbol: 'ETH' },
      });
      expect(out.unsigned).toMatchObject({ gas: '21000', nonce: 3 });

      // The fee the account holder was shown is recorded, not reconstructed
      // later: gas 21000 × cap 2000000000, exactly, in base units.
      expect(row?.['feeRaw']).toBe('42000000000000');
      expect(row?.['metadata']).toMatchObject({
        build: expect.objectContaining({ nonce: 3, gas: '21000' }),
      });
    });

    it('stores the payload the unsigned transaction returned', async () => {
      seed();
      const out = await svc.assemble('tx1', 'u1');
      const metadata = store.rows.get('tx1')?.['metadata'] as {
        build?: { payload?: { to: string; value: string; data: string } };
      };
      expect(metadata.build?.payload).toEqual({
        to: out.unsigned.to,
        value: out.unsigned.value,
        data: out.unsigned.data,
      });
    });

    it('stores the ERC-20 transfer encoding and relays a signature that matches it', async () => {
      seed();
      adapter.buildTransaction.mockImplementation(async (req: { to: string; value?: string; token?: string }) => {
        const assemble = adapter.assemblePayload as (input: typeof req) => {
          to: string;
          value: string;
          data: string;
        };
        const payload = assemble(req);
        return {
          ...payload,
          chainId: 1,
          gas: '21000',
          nonce: 3,
          maxFeePerGas: '2000000000',
          maxPriorityFeePerGas: '100000000',
        };
      });

      await svc.assemble('tx1', 'u1');
      const payload = (
        store.rows.get('tx1')?.['metadata'] as {
          build: { payload: { to: string; value: string; data: string } };
        }
      ).build.payload;
      // The transfer encoding assemblePayload already produces: the token
      // contract, no value, and the transfer selector the stub returns.
      expect(payload).toEqual({ to: '0xgold', value: '0', data: '0xa9059cbb' });

      await svc.markSigned('tx1', OWNER);
      adapter.decodeSignedTransaction.mockResolvedValue({
        chainId: 1,
        from: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        to: payload.to,
        value: payload.value,
        nonce: 3,
        data: payload.data,
      });
      await svc.relay('tx1', 'u1', '0x' + 'ab'.repeat(80));
      expect(adapter.broadcastTransaction).toHaveBeenCalledTimes(1);
    });

    it('assembles a prepared call instead of an ERC-20 transfer, and the value is 0', async () => {
      seed({
        metadata: {
          preparedCall: {
            to: '0x1111111111111111111111111111111111111111',
            value: '5',
            data: '0xexact',
          },
        },
      });
      adapter.buildTransaction.mockImplementation(
        async (req: { to: string; value?: string; data?: string; token?: string; amount?: string }) => ({
          to: req.to,
          value: req.value ?? '0',
          data: req.data ?? '0x',
          chainId: 1,
          gas: '21000',
          nonce: 4,
          maxFeePerGas: '2',
          maxPriorityFeePerGas: '1',
        }),
      );

      await svc.assemble('tx1', 'u1');
      const request = adapter.buildTransaction.mock.calls[0]?.[0] as {
        to: string;
        value?: string;
        data?: string;
        token?: string;
        amount?: string;
      };
      expect(request).toMatchObject({
        to: '0x1111111111111111111111111111111111111111',
        value: '0',
        data: '0xexact',
      });
      expect(request.token).toBeUndefined();
      expect(request.amount).toBeUndefined();
      const payload = (
        store.rows.get('tx1')?.['metadata'] as {
          build: { payload: { to: string; value: string; data: string } };
        }
      ).build.payload;
      expect(payload).toEqual({
        to: '0x1111111111111111111111111111111111111111',
        value: '0',
        data: '0xexact',
      });
    });

    it('assembles a native transfer as value to the destination', async () => {
      // The row's `assetId` is the foreign key, not the derived registry key.
      seed({ assetId: 'native1' });
      await svc.assemble('tx1', 'u1');

      const request = adapter.buildTransaction.mock.calls[0]?.[0];
      expect(request).toMatchObject({
        chainId: '1',
        to: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        value: '100000000',
      });
      expect(request.token).toBeUndefined();
      expect(request.amount).toBeUndefined();
    });

    it('refuses to assemble for someone else\'s transaction, and never calls the chain', async () => {
      seed();
      await expect(svc.assemble('tx1', 'u2')).rejects.toThrow(/not found/i);
      expect(adapter.buildTransaction).not.toHaveBeenCalled();
    });

    it('refuses an intent that is no longer unsigned', async () => {
      seed({ state: 'signed' });
      await expect(svc.assemble('tx1', 'u1')).rejects.toThrow(/unsigned intent/i);
    });

    it('refuses an inbound transfer: there is nothing for the owner to sign', async () => {
      seed({ direction: 'in', destination: null });
      await expect(svc.assemble('tx1', 'u1')).rejects.toThrow(/nothing to sign/i);
    });

    it('reports a transport failure without leaking the endpoint', async () => {
      seed();
      adapter.buildTransaction.mockRejectedValue(
        new Error('All 1 RPC endpoint(s) failed for this read. Last error: http://rpc.internal:8545/key'),
      );
      await expect(svc.assemble('tx1', 'u1')).rejects.toMatchObject({ status: 503 });
    });

    it('surfaces a node decline as a client error, with the endpoint redacted out of it', async () => {
      seed();
      adapter.buildTransaction.mockRejectedValue(
        new Error('execution reverted: insufficient funds at http://rpc.internal:8545/v1'),
      );
      await expect(svc.assemble('tx1', 'u1')).rejects.toMatchObject({ status: 400 });
      await svc.assemble('tx1', 'u1').catch((err: Error) => {
        expect(err.message).not.toContain('rpc.internal');
        expect(err.message).toContain('insufficient funds');
      });
    });
  });

  describe('relaying a signed send', () => {
    const SIGNED = '0x' + 'ab'.repeat(80);

    it('verifies the payload against the intent, relays it, and records the hash', async () => {
      seed();
      await svc.markSigned('tx1', OWNER);
      adapter.broadcastTransaction.mockResolvedValue('0x' + '9'.repeat(64));

      await svc.relay('tx1', 'u1', SIGNED);

      // Decoded before anything goes to the network, and compared against
      // what this server assembled — not against itself.
      expect(adapter.decodeSignedTransaction).toHaveBeenCalledWith(SIGNED);
      expect(adapter.broadcastTransaction).toHaveBeenCalledWith(SIGNED);

      const row = store.rows.get('tx1');
      expect(row?.['state']).toBe('broadcast');
      expect(row?.['txHash']).toBe('0x' + '9'.repeat(64));
      expect(row?.['broadcastAt']).toBeInstanceOf(Date);
    });

    it('refuses a payload signed by a different account, before any network call', async () => {
      seed();
      await svc.markSigned('tx1', OWNER);
      adapter.decodeSignedTransaction.mockResolvedValue({
        chainId: 1,
        from: '0x9999999999999999999999999999999999999999',
        to: '0xgold',
        value: '0',
        nonce: 3,
        data: '0xa9059cbb',
      });

      await expect(svc.relay('tx1', 'u1', SIGNED)).rejects.toThrow(/different account/i);
      expect(adapter.broadcastTransaction).not.toHaveBeenCalled();
      expect(store.rows.get('tx1')?.['state']).toBe('signed');
    });

    it('refuses a payload signed for another chain', async () => {
      seed();
      await svc.markSigned('tx1', OWNER);
      adapter.decodeSignedTransaction.mockResolvedValue({
        chainId: 8453,
        from: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        to: '0xgold',
        value: '0',
        nonce: 3,
        data: '0xa9059cbb',
      });

      await expect(svc.relay('tx1', 'u1', SIGNED)).rejects.toThrow(/chain/i);
      expect(adapter.broadcastTransaction).not.toHaveBeenCalled();
    });

    it('refuses a payload whose value and destination are not the intent\'s', async () => {
      seed();
      await svc.markSigned('tx1', OWNER);
      adapter.decodeSignedTransaction.mockResolvedValue({
        chainId: 1,
        from: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        // The right account, paid to someone else.
        to: '0x7777777777777777777777777777777777777777',
        value: '0',
        nonce: 3,
        data: '0xa9059cbb',
      });

      await expect(svc.relay('tx1', 'u1', SIGNED)).rejects.toThrow(/destination|does not match/i);
      expect(adapter.broadcastTransaction).not.toHaveBeenCalled();
    });

    it('refuses before the signature has been reported', async () => {
      seed();
      await expect(svc.relay('tx1', 'u1', SIGNED)).rejects.toThrow(/reported as signed/i);
      expect(adapter.decodeSignedTransaction).not.toHaveBeenCalled();
    });

    it('refuses someone else\'s transaction without decoding anything', async () => {
      seed();
      await svc.markSigned('tx1', OWNER);
      await expect(svc.relay('tx1', 'u2', SIGNED)).rejects.toThrow(/not found/i);
      expect(adapter.decodeSignedTransaction).not.toHaveBeenCalled();
    });

    it('rejects a signature whose data differs from the stored payload and does not broadcast', async () => {
      // The decoded bytes match the ERC-20 transfer assemblePayload would
      // re-derive. The stored payload is a different call. Relay must use
      // the stored one.
      seed({
        state: 'signed',
        metadata: {
          build: {
            payload: {
              to: '0x1111111111111111111111111111111111111111',
              value: '0',
              data: '0xstored',
            },
          },
        },
      });
      adapter.decodeSignedTransaction.mockResolvedValue({
        chainId: 1,
        from: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        to: '0xgold',
        value: '0',
        data: '0xa9059cbb',
      });

      await expect(svc.relay('tx1', 'u1', SIGNED)).rejects.toThrow(/does not match/i);
      expect(adapter.broadcastTransaction).not.toHaveBeenCalled();
      expect(store.rows.get('tx1')?.['state']).toBe('signed');
    });

    it('relays when the signed payload matches the stored payload', async () => {
      seed({
        state: 'signed',
        metadata: {
          build: {
            payload: {
              to: '0x1111111111111111111111111111111111111111',
              value: '0',
              data: '0xexactinput',
            },
          },
        },
      });
      adapter.decodeSignedTransaction.mockResolvedValue({
        chainId: 1,
        from: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        to: '0x1111111111111111111111111111111111111111',
        value: '0',
        data: '0xexactinput',
      });
      adapter.broadcastTransaction.mockResolvedValue('0x' + '9'.repeat(64));

      await svc.relay('tx1', 'u1', SIGNED);
      expect(adapter.broadcastTransaction).toHaveBeenCalledWith(SIGNED);
      expect(store.rows.get('tx1')?.['state']).toBe('broadcast');
    });

    it('leaves the row in signed when the network refuses the payload', async () => {
      seed();
      await svc.markSigned('tx1', OWNER);
      adapter.broadcastTransaction.mockRejectedValue(
        new Error('All 1 RPC endpoint(s) failed for this read. Last error: nonce too low'),
      );

      await expect(svc.relay('tx1', 'u1', SIGNED)).rejects.toMatchObject({ status: 503 });
      expect(store.rows.get('tx1')?.['state']).toBe('signed');
      expect(store.rows.get('tx1')?.['txHash']).toBeNull();
    });
  });

  describe('drops and reappearance', () => {
    beforeEach(async () => {
      seed({ state: 'broadcast', txHash: '0x' + 'c'.repeat(64), confirmations: 0 });
    });

    it('tells a stranger nothing, even on the observation path', async () => {
      // The route guard already refuses customers, but the service must
      // not depend on the route: an observation binds a row to a hash for
      // life, so a foreign id must not even resolve here.
      await expect(
        svc.observe('tx1', OTHER, { txHash: '0x' + 'c'.repeat(64), confirmations: 1, outcome: 'seen' }),
      ).rejects.toThrow(/not found/i);
    });

    it('promotes to pending when the node sees it', async () => {
      await svc.observe('tx1', SUPPORT, {
        txHash: '0x' + 'c'.repeat(64), confirmations: 1, outcome: 'seen',
      });
      expect(store.rows.get('tx1')?.['state']).toBe('pending');
    });

    it('lets a dropped transaction be re-broadcast, and counts the drop', async () => {
      await svc.transition('tx1', 'pending', SUPPORT, { to: 'pending' });
      await svc.transition('tx1', 'broadcast', SUPPORT, { to: 'broadcast', txHash: '0x' + 'c'.repeat(64) });

      const row = store.rows.get('tx1');
      expect(row?.['state']).toBe('broadcast');
      // One transaction, one row, one identity — not a dead record and a new one.
      expect(row?.['dropCount']).toBe(1);
      expect(row?.['droppedAt']).toBeInstanceOf(Date);
    });

    it('refuses to re-broadcast onto a different hash', async () => {
      await svc.observe('tx1', SUPPORT, {
        txHash: '0x' + 'd'.repeat(64), confirmations: 1, outcome: 'seen',
      }).catch(() => undefined);
      await expect(
        svc.observe('tx1', SUPPORT, { txHash: '0x' + 'e'.repeat(64), confirmations: 2, outcome: 'seen' }),
      ).rejects.toThrow(/already bound to hash/);
    });
  });

  describe('confirmation counting', () => {
    beforeEach(async () => {
      seed({
        state: 'broadcast',
        txHash: '0x' + 'c'.repeat(64),
        requiredConfirmations: 12,
      });
      await svc.transition('tx1', 'pending', SUPPORT, { to: 'pending' });
    });

    it('stays pending below the required depth, however many times it is called', async () => {
      for (const depth of [1, 5, 11]) {
        await svc.observe('tx1', SUPPORT, {
          txHash: '0x' + 'c'.repeat(64), confirmations: depth, outcome: 'seen',
        });
        expect(store.rows.get('tx1')?.['state']).toBe('pending');
      }
      expect(store.rows.get('tx1')?.['confirmations']).toBe(11);
    });

    it('confirms at the required depth and not before', async () => {
      await svc.observe('tx1', SUPPORT, {
        txHash: '0x' + 'c'.repeat(64), confirmations: 11, outcome: 'seen',
      });
      expect(store.rows.get('tx1')?.['state']).toBe('pending');

      await svc.observe('tx1', SUPPORT, {
        txHash: '0x' + 'c'.repeat(64), confirmations: 12, outcome: 'seen',
      });
      expect(store.rows.get('tx1')?.['state']).toBe('confirmed');
      expect(store.rows.get('tx1')?.['confirmedAt']).toBeInstanceOf(Date);
    });

    it('demotes a confirmed row when the depth falls back, and counts the reorg', async () => {
      await svc.observe('tx1', SUPPORT, {
        txHash: '0x' + 'c'.repeat(64), confirmations: 12, outcome: 'seen',
      });
      await svc.observe('tx1', SUPPORT, {
        txHash: '0x' + 'c'.repeat(64), confirmations: 4, outcome: 'seen',
      });

      const row = store.rows.get('tx1');
      expect(row?.['state']).toBe('pending');
      expect(row?.['confirmedAt']).toBeNull();
      expect(row?.['dropCount']).toBe(1);
    });

    it('states the chain as the reason for an un-confirmation', async () => {
      await svc.observe('tx1', SUPPORT, {
        txHash: '0x' + 'c'.repeat(64), confirmations: 12, outcome: 'seen',
      });
      await svc.observe('tx1', SUPPORT, {
        txHash: '0x' + 'c'.repeat(64), confirmations: 4, outcome: 'seen',
      });
      const call = audit.recordChange.mock.calls.at(-1)?.[0];
      expect(call.reason).toMatch(/Chain reorg/);
    });

    it('refuses an owner observing their own transaction', async () => {
      await expect(
        svc.observe('tx1', OWNER, { txHash: '0x' + 'c'.repeat(64), confirmations: 12, outcome: 'seen' }),
      ).rejects.toThrow(/support may observe/);
    });

    it('fails a transaction a node reports as reverted', async () => {
      await svc.observe('tx1', SUPPORT, {
        txHash: '0x' + 'c'.repeat(64), confirmations: 0, outcome: 'reverted',
      });
      expect(store.rows.get('tx1')).toMatchObject({ state: 'failed', errorCode: 'reverted' });
    });
  });

  describe('moving a settled record backwards needs a reason', () => {
    beforeEach(() => seed({ state: 'confirmed', txHash: '0x' + 'f'.repeat(64), confirmations: 12 }));

    it('refuses confirmed → failed with no reason, and does not move the row', async () => {
      await expect(svc.transition('tx1', 'failed', SUPPORT, { to: 'failed' }))
        .rejects.toThrow(/at least 8 characters/);
      expect(store.rows.get('tx1')?.['state']).toBe('confirmed');
    });

    it('refuses a placeholder that is technically long enough to be useless', () => {
      expect(() => assertReason('transaction.confirmed>failed', '   ')).toThrow();
      expect(() => assertReason('transaction.confirmed>failed', 'asdfghjk')).not.toThrow();
    });

    it('accepts one and moves the row', async () => {
      await svc.transition('tx1', 'failed', SUPPORT, {
        to: 'failed', reason: 'Reorg past the required depth; block 21,443,901 orphaned.',
      });
      const row = store.rows.get('tx1');
      expect(row?.['state']).toBe('failed');
      expect(row?.['failedAt']).toBeInstanceOf(Date);
      expect(audit.recordChange.mock.calls.at(-1)?.[0].reason).toMatch(/Reorg/);
    });

    it('records the failure code with it', async () => {
      await svc.transition('tx1', 'failed', SUPPORT, {
        to: 'failed', reason: 'Reorg past the required depth.', errorCode: 'reorg',
      });
      expect(store.rows.get('tx1')?.['errorCode']).toBe('reorg');
    });

    it('truncates a provider error string that would leak topology', async () => {
      await svc.transition('tx1', 'failed', SUPPORT, {
        to: 'failed',
        reason: 'Reorg past the required depth.',
        errorMessage: `rpc error at ${'x'.repeat(400)}`,
      });
      expect(String(store.rows.get('tx1')?.['errorMessage'])).toHaveLength(200);
    });
  });

  describe('inbound transfers', () => {
    beforeEach(() => seed({ direction: 'in', destination: null }));

    it('has no signed hop — nobody signs an inbound transfer', async () => {
      await expect(svc.markSigned('tx1', OWNER)).rejects.toThrow(/from "created" to "signed"/);
    });

    it('goes from created straight to pending when a node reports it', async () => {
      await svc.observe('tx1', SUPPORT, {
        txHash: '0x' + '1'.repeat(64), confirmations: 1, outcome: 'seen',
      });
      expect(store.rows.get('tx1')).toMatchObject({ state: 'pending', txHash: '0x' + '1'.repeat(64) });
    });

    it('refuses a broadcast hop it never took', async () => {
      await expect(svc.transition('tx1', 'broadcast', SUPPORT, { to: 'broadcast', txHash: '0x' + '1'.repeat(64) }))
        .rejects.toThrow(/from "created" to "broadcast"/);
    });
  });

  describe('concurrent updates', () => {
    it('refuses the loser of a race rather than letting it overwrite', async () => {
      seed({ state: 'pending', txHash: '0x' + '9'.repeat(64), requiredConfirmations: 12 });

      // Both operators read `pending` before either writes. Simulated by
      // snapshotting the row, running one transition, then replaying the
      // other's decision against the now-moved row — which is exactly what a
      // second in-flight request does.
      const staleRead = { ...store.rows.get('tx1') } as Row;
      await svc.observe('tx1', SUPPORT, {
        txHash: staleRead['txHash'] as string, confirmations: 12, outcome: 'seen',
      });
      expect(store.rows.get('tx1')?.['state']).toBe('confirmed');

      // The second writer's `where` still says `pending`, so it matches zero rows.
      const { count } = await store.prisma.transaction.updateMany({
        where: { id: 'tx1', state: 'pending' },
        data: { state: 'failed' },
      });
      expect(count).toBe(0);
      expect(store.rows.get('tx1')?.['state']).toBe('confirmed');
    });

    it('reports the conflict in the message, including where the row actually is', async () => {
      seed({ state: 'pending', txHash: '0x' + '9'.repeat(64), requiredConfirmations: 12 });

      const first = svc.observe('tx1', SUPPORT, {
        txHash: '0x' + '9'.repeat(64), confirmations: 12, outcome: 'seen',
      });
      // Interleaved before the first settles: the second read sees the row the
      // first is about to move.
      const racing = svc.transition('tx1', 'failed', SUPPORT, { to: 'failed', reason: 'a reason long enough' });
      await Promise.allSettled([first, racing]);

      const calls = audit.record.mock.calls.map((c) => c[0]);
      const states = calls.filter((c) => c.action === 'transaction.transition.conflict');
      // Either the race produced a conflict or the transition lost on the
      // allowlist first; both are refusals, and neither leaves a half-move.
      expect(states.length + calls.filter((c) => c.action.startsWith('transaction.transition.rejected')).length)
        .toBeGreaterThan(0);
    });

    it('carries the expected state in the where clause, not just in the read', async () => {
      await svc.markSigned('tx1', OWNER);
      const last = store.written.at(-1);
      expect(last?.where).toEqual({ id: 'tx1', state: 'created' });
      expect(last?.data).toMatchObject({ state: 'signed' });
    });
  });

  describe('expiry', () => {
    it('expires only intents that never reached the network', async () => {
      seed({ state: 'broadcast', txHash: '0x' + 'a'.repeat(64), expiresAt: new Date(Date.now() - 1000) });
      const result = await svc.expireStale();
      expect(result.expired).toBe(0);
      expect(store.rows.get('tx1')?.['state']).toBe('broadcast');
    });

    it('expires an unsigned intent past its expiry', async () => {
      seed({ expiresAt: new Date(Date.now() - 1000) });
      const result = await svc.expireStale();
      expect(result.expired).toBe(1);
      expect(store.rows.get('tx1')?.['state']).toBe('expired');
      expect(audit.recordChange.mock.calls.at(-1)?.[0].actorRole).toBe('system');
    });
  });

  describe('daily series', () => {
    const dayAgo = (days: number) => {
      const d = new Date();
      d.setUTCHours(12, 0, 0, 0);
      d.setUTCDate(d.getUTCDate() - days);
      return d;
    };

    it('returns one bucket per day, oldest first, with zeros for quiet days', async () => {
      store = makeStore([
        tx({ id: 'a', createdAt: dayAgo(0), state: 'confirmed', amountUsd: { toString: () => '10' } }),
        tx({ id: 'b', createdAt: dayAgo(2), state: 'created', amountUsd: null }),
      ]);
      svc = new TransactionsService(store.prisma as never, audit as never, blockchain as never, settings);
      const series = await svc.daily(3);
      expect(series.map((s) => s.count)).toEqual([1, 0, 1]);
      const dates = series.map((s) => s.date);
      expect(dates).toEqual([...dates].sort());
    });

    it('counts volume from confirmed rows only — intent is not flow', async () => {
      const now = dayAgo(0);
      store = makeStore([
        tx({ id: 'a', createdAt: now, state: 'confirmed', amountUsd: { toString: () => '10.005' } }),
        tx({ id: 'b', createdAt: now, state: 'broadcast', amountUsd: { toString: () => '999' } }),
      ]);
      svc = new TransactionsService(store.prisma as never, audit as never, blockchain as never, settings);
      const series = await svc.daily(1);
      expect(series).toHaveLength(1);
      // 10.005 rounds to cents; the 999 from the unconfirmed row never lands.
      expect(series[0]?.volumeUsd).toBe(10.01);
      expect(series[0]?.count).toBe(2);
    });

    it('excludes rows older than the window', async () => {
      store = makeStore([
        tx({ id: 'old', createdAt: dayAgo(30), state: 'confirmed', amountUsd: { toString: () => '5' } }),
        tx({ id: 'new', createdAt: dayAgo(0), state: 'confirmed', amountUsd: { toString: () => '7' } }),
      ]);
      svc = new TransactionsService(store.prisma as never, audit as never, blockchain as never, settings);
      const series = await svc.daily(7);
      expect(series).toHaveLength(7);
      expect(series.reduce((n, s) => n + s.count, 0)).toBe(1);
      expect(series.reduce((n, s) => n + s.volumeUsd, 0)).toBe(7);
    });
  });

  describe('create', () => {
    const good = {
      walletId: 'w1',
      assetId: '1:0xgold:c1',
      amountRaw: '100000000',
      destination: '0xDAC17F958D2EE523A2206206994597C13D831EC7',
    };

    it("takes the owner from the wallet, not from the caller", async () => {
      const created = await svc.create({ ...good, direction: 'out' } as never, 'u1');
      expect(created.userId).toBe('u1');
    });

    it('refuses a wallet that is not the caller’s', async () => {
      await expect(svc.create({ ...good } as never, 'u2')).rejects.toThrow(/Wallet not found/);
    });

    it('refuses a zero amount', async () => {
      await expect(svc.create({ ...good, amountRaw: '0' } as never, 'u1'))
        .rejects.toThrow(/positive decimal/);
    });

    it('refuses an outbound movement with no destination', async () => {
      await expect(
        svc.create({ ...good, destination: undefined, direction: 'out' } as never, 'u1'),
      ).rejects.toThrow(/needs a destination/);
    });

    it('refuses an asset from another chain rather than recording an unresolvable row', async () => {
      await expect(svc.create({ ...good, assetId: '8453:0xgold:c1' } as never, 'u1'))
        .rejects.toThrow(/is on chain 8453, not 1/);
    });

    it('normalises a checksummed destination rather than storing two spellings of one address', async () => {
      const created = await svc.create({ ...good } as never, 'u1');
      expect(created.destination).toBe('0xdac17f958d2ee523a2206206994597c13d831ec7');
    });

    it('takes the intent lifetime from the setting', async () => {
      // A 45-minute window against the 15-minute default. The intent is
      // stamped with `expiresAt` at creation and the expiry sweep reads that
      // stored value, so changing the setting never moves a settled row.
      const longer = new TransactionsService(
        store.prisma as never,
        audit as never,
        blockchain as never,
        {
          get: async (key: string) =>
            key === 'transactions.intent-ttl-minutes'
              ? 45
              : settingDefinition(key)!.default,
        } as never,
      );
      const before = Date.now();
      const created = await longer.create({ ...good } as never, 'u1');
      const expiresAt = created.expiresAt as Date;
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 45 * 60_000);
      expect(expiresAt.getTime()).toBeLessThan(Date.now() + 46 * 60_000);
    });

    it('a caller that names its own lifetime still wins over the setting', async () => {
      const created = await svc.create({ ...good, expiresInMinutes: 5 } as never, 'u1');
      const expiresAt = created.expiresAt as Date;
      expect(expiresAt.getTime()).toBeLessThan(Date.now() + 6 * 60_000);
    });

    it('starts in `created` and never anywhere else', async () => {
      const created = await svc.create({ ...good } as never, 'u1');
      expect(created.state).toBe('created');
      expect(created.txHash).toBeNull();
    });
  });
});