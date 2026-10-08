import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assertReason } from '../audit/audit.service.js';
import type { ObservedTokenTransfer } from '@correnthian/blockchain';
import { TransactionsService } from '../transactions/transactions.service.js';
import { TransactionIndexingService, type ChainIndexReport } from './transaction-indexing.service.js';

/**
 * BE-302 — observed transfers become `Transaction` rows.
 *
 * The assertions are on the *store*, not on the return value, because the
 * claim under test is that a deposit ends up in the ledger. A service that
 * reported success and wrote nothing would pass every check of its own return
 * shape.
 *
 * The fake below evaluates the `where` clauses it is given. A stub returning
 * a canned row cannot fail a filter, so a test built on one proves only that
 * the test was written.
 */

const NOW = new Date('2026-10-08T12:00:00.000Z');

const CHAIN_ID = 'evm:1';
const WALLET_ADDRESS = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const COUNTERPARTY = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const TOKEN = '0xcccccccccccccccccccccccccccccccccccccccc';
const UNKNOWN_TOKEN = '0xdddddddddddddddddddddddddddddddddddddddd';
const ASSET_KEY = `evm:1:${TOKEN}:iss1`;

const CHAIN = {
  id: CHAIN_ID,
  name: 'Ethereum',
  family: 'evm' as const,
  nativeSymbol: 'ETH',
  decimals: 18,
  rpcUrls: ['http://rpc.invalid'],
  explorerUrl: null,
  gasPriceUsd: null,
  enabled: true,
  isTestnet: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

type Row = Record<string, any>;

function transfer(partial: Partial<ObservedTokenTransfer>): ObservedTokenTransfer {
  return {
    txHash: `0x${'1'.repeat(64)}`,
    logIndex: 0,
    blockNumber: 100n,
    token: TOKEN,
    from: COUNTERPARTY,
    to: WALLET_ADDRESS,
    amountRaw: '1000000',
    ...partial,
  };
}

/** In-memory `Transaction` with the unique index and the CAS both enforced. */
function makeStore() {
  const rows = new Map<string, Row>();

  const prisma = {
    chain: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === CHAIN_ID ? { ...CHAIN } : null,
    },
    wallet: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === 'w1'
          ? {
              id: 'w1',
              userId: 'u1',
              address: WALLET_ADDRESS,
              chainId: CHAIN_ID,
              chain: { id: CHAIN_ID, family: 'evm', enabled: true },
            }
          : null,
      findMany: async () => [
        { id: 'w1', address: WALLET_ADDRESS },
      ],
    },
    asset: {
      findUnique: async ({ where }: { where: { assetId: string } }) =>
        where.assetId === ASSET_KEY ? asset : null,
      findMany: async (args?: { where?: Row }) => {
        const enabled = args?.where?.enabled;
        if (enabled === false) return [];
        return [{ ...asset }];
      },
    },
    transaction: {
      findUnique: async ({ where }: { where: any }) => {
        if (where.id) {
          const row = rows.get(where.id);
          return row ? { ...row } : null;
        }
        const key = where.chainId_txHash;
        if (key) {
          const found = [...rows.values()].find(
            (r) => r.chainId === key.chainId && r.txHash === key.txHash,
          );
          return found ? { ...found } : null;
        }
        return null;
      },
      create: async ({ data }: { data: Row }) => {
        // The real unique index, so "a duplicate event" is a constraint
        // violation and not a guard that could be forgotten.
        if (data.txHash) {
          const clash = [...rows.values()].find(
            (r) => r.chainId === data.chainId && r.txHash === data.txHash,
          );
          if (clash) {
            const err = new Error('Unique constraint failed on (chainId, txHash)');
            (err as any).code = 'P2002';
            throw err;
          }
        }
        const row = {
          id: `tx${rows.size + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          dropCount: 0,
          confirmations: 0,
          requiredConfirmations: 12,
          ...data,
        };
        rows.set(row.id, row);
        return { ...row };
      },
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        const row = rows.get(where.id as string);
        if (!row) return { count: 0 };
        // The guard `apply` relies on: the state read is the state written on.
        if (where.state !== undefined && row.state !== where.state) return { count: 0 };
        for (const [key, value] of Object.entries(data)) {
          if (value && typeof value === 'object' && 'increment' in (value as Row)) {
            row[key] = ((row[key] as number) ?? 0) + (value as { increment: number }).increment;
          } else {
            row[key] = value;
          }
        }
        row.updatedAt = new Date(NOW.getTime() + 1);
        return { count: 1 };
      },
      findMany: async (args?: { where?: Row; orderBy?: Row; take?: number }) => {
        const w = args?.where ?? {};
        let out = [...rows.values()];
        if (w.chainId) out = out.filter((r) => r.chainId === w.chainId);
        if (w.state?.in) out = out.filter((r) => (w.state.in as string[]).includes(r.state));
        if (w.blockNumber && 'not' in w.blockNumber) {
          const wanted = w.blockNumber.not;
          out = out.filter((r) =>
            wanted === null ? r.blockNumber !== null && r.blockNumber !== undefined : r.blockNumber !== wanted,
          );
        }
        if (w.id?.notIn) out = out.filter((r) => !(w.id.notIn as string[]).includes(r.id));
        if (args?.orderBy?.updatedAt === 'asc') {
          out = [...out].sort((a, b) => (a.updatedAt as Date).getTime() - (b.updatedAt as Date).getTime());
        }
        if (args?.take) out = out.slice(0, args.take);
        return out.map((r) => ({ ...r }));
      },
      count: async () => rows.size,
      groupBy: async () => [],
    },
    auditLog: { create: async () => ({}) },
  };

  return { prisma, rows };
}

const asset = {
  id: 'a1',
  assetId: ASSET_KEY,
  chainId: CHAIN_ID,
  contractAddress: TOKEN,
  tokenStandard: 'erc20',
  symbol: 'XAUT',
  name: 'Tokenised Gold',
  decimals: 6,
  enabled: true,
  transferSupported: true,
};

const audit = {
  record: vi.fn(async () => {}),
  recordChange: vi.fn(async () => ({})),
  assertReason,
};

function makeAdapter(options?: {
  head?: bigint;
  logs?: ObservedTokenTransfer[];
  onRead?: (range: { fromBlock: bigint; toBlock: bigint }) => void;
}) {
  const head = options?.head ?? 112n;
  const logs = options?.logs ?? [];
  const getTokenTransfers = vi.fn(
    async (params: { fromBlock: bigint; toBlock: bigint }) => {
      options?.onRead?.(params);
      return logs.filter((l) => l.blockNumber >= params.fromBlock && l.blockNumber <= params.toBlock);
    },
  );
  const getBlockNumber = vi.fn(async () => head);
  const adapter = { getTokenTransfers, getBlockNumber } as any;
  const blockchain = { forChain: vi.fn(async () => adapter) } as any;
  return { adapter, blockchain, getTokenTransfers, getBlockNumber };
}

function makeService(adapterFactory: () => ReturnType<typeof makeAdapter>) {
  const store = makeStore();
  const transactions = new TransactionsService(store.prisma as any, audit as any);
  const built = adapterFactory();
  const indexing = new TransactionIndexingService(
    store.prisma as any,
    built.blockchain,
    transactions,
  );
  return { store, indexing, built, transactions };
}

/** The first element, failing loudly rather than returning `undefined`. */
function first<T>(items: readonly T[], what: string): T {
  const value = items[0];
  if (value === undefined) throw new Error(`expected at least one ${what}`);
  return value;
}

/** The one row, failing loudly rather than returning `undefined`. */
function onlyRow(store: { rows: Map<string, Row> }): Row {
  const rows = [...store.rows.values()];
  if (rows.length !== 1) throw new Error(`expected exactly 1 row, found ${rows.length}`);
  return rows[0] as Row;
}

/** A named row, failing loudly rather than returning `undefined`. */
function rowById(store: { rows: Map<string, Row> }, id: string): Row {
  const found = store.rows.get(id);
  if (!found) throw new Error(`no row ${id}`);
  return found;
}

function run(
  indexing: TransactionIndexingService,
  opts?: { resumeFrom?: bigint | null; signal?: AbortSignal; now?: Date },
): Promise<ChainIndexReport> {
  return indexing.indexChain({
    chainId: CHAIN_ID,
    resumeFrom: opts?.resumeFrom ?? null,
    signal: opts?.signal ?? new AbortController().signal,
    now: opts?.now ?? NOW,
  });
}

describe('TransactionIndexingService', () => {
  beforeEach(() => {
    audit.record.mockClear();
    audit.recordChange.mockClear();
  });

  it('files a confirmed inbound transfer as one row with state, hash and confirmations', async () => {
    const { store, indexing } = makeService(() =>
      makeAdapter({ head: 112n, logs: [transfer({ blockNumber: 100n })] }),
    );

    const report = await run(indexing);

    expect(report.errors).toEqual([]);
    expect(report.rowsCreated).toBe(1);
    expect(report.complete).toBe(true);

    const row = onlyRow(store);
    expect(row).toMatchObject({
      txHash: `0x${'1'.repeat(64)}`,
      state: 'confirmed',
      direction: 'in',
      confirmations: 12,
      requiredConfirmations: 12,
      amountRaw: '1000000',
      walletId: 'w1',
      userId: 'u1',
      assetId: 'a1',
      chainId: CHAIN_ID,
    });
    expect(row.blockNumber).toBe(100n);
    // Nothing signed and nothing broadcast from here, so there is no intent to
    // expire. `expireStale` only sweeps rows still in `created`, but the column
    // being unset states the same thing at the point of write.
    expect(row.expiresAt ?? null).toBeNull();
    expect(row.amountUsd).toBeNull();
  });

  it('leaves a shallow transfer pending until it reaches the required depth', async () => {
    const { store, indexing } = makeService(() =>
      makeAdapter({ head: 105n, logs: [transfer({ blockNumber: 100n })] }),
    );

    await run(indexing);

    const row = onlyRow(store);
    expect(row.state).toBe('pending');
    expect(row.confirmations).toBe(5);
    expect(row.requiredConfirmations).toBe(12);
  });

  it('does not create a second row when the same event is indexed again', async () => {
    const made = makeService(() =>
      makeAdapter({ head: 112n, logs: [transfer({ blockNumber: 100n })] }),
    );

    const first = await run(made.indexing);
    const second = await run(made.indexing);

    expect(first.rowsCreated).toBe(1);
    expect(second.rowsCreated).toBe(0);
    expect(made.store.rows.size).toBe(1);
    expect(second.errors).toEqual([]);
  });

  it('files an outbound transfer from a registered wallet, addressed to the counterparty', async () => {
    const { store, indexing } = makeService(() =>
      makeAdapter({
        head: 112n,
        logs: [transfer({ blockNumber: 100n, from: WALLET_ADDRESS, to: COUNTERPARTY })],
      }),
    );

    await run(indexing);

    const row = onlyRow(store);
    expect(row.direction).toBe('out');
    expect(row.walletId).toBe('w1');
    expect(row.destination).toBe(COUNTERPARTY);
  });

  it('sums the legs of one hash that share an asset, and says how many there were', async () => {
    const { store, indexing } = makeService(() =>
      makeAdapter({
        head: 112n,
        logs: [
          transfer({ blockNumber: 100n, logIndex: 3, amountRaw: '700' }),
          transfer({ blockNumber: 100n, logIndex: 7, amountRaw: '300' }),
        ],
      }),
    );

    const report = await run(indexing);

    expect(report.rowsCreated).toBe(1);
    const row = onlyRow(store);
    expect(row.amountRaw).toBe('1000');
    // The schema holds one row per hash, so a partial figure has to say so.
    expect(row.metadata).toMatchObject({ transferCount: 2, otherTransfers: 0, logIndex: 3 });
  });

  it('does not file a token that is not in the enabled registry', async () => {
    const { store, indexing } = makeService(() =>
      makeAdapter({
        head: 112n,
        logs: [transfer({ blockNumber: 100n, token: UNKNOWN_TOKEN })],
      }),
    );

    const report = await run(indexing);

    expect(store.rows.size).toBe(0);
    expect(report.skippedUnknownToken).toBe(1);
    expect(report.rowsCreated).toBe(0);
  });

  // --- reorgs --------------------------------------------------------------

  it('moves a settled row backwards instead of duplicating it when the head falls below its block', async () => {
    const { store, indexing } = makeService(() => makeAdapter({ head: 90n }));
    // Written while the head was 200: 100 confirmations, settled.
    store.rows.set('tx1', {
      id: 'tx1',
      chainId: CHAIN_ID,
      walletId: 'w1',
      userId: 'u1',
      assetId: 'a1',
      direction: 'in',
      state: 'confirmed',
      txHash: `0x${'2'.repeat(64)}`,
      amountRaw: '1000000',
      blockNumber: 100n,
      confirmations: 100,
      requiredConfirmations: 12,
      dropCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const report = await run(indexing, { resumeFrom: 200n });

    expect(report.errors).toEqual([]);
    expect(store.rows.size).toBe(1);
    const row = rowById(store, 'tx1');
    expect(row.state).toBe('pending');
    expect(row.confirmations).toBe(0);
    expect(row.dropCount).toBe(1);
    expect(report.depthChanged).toBe(1);
    // `lastSeenAt` is "when the chain was last observed to hold this
    // transaction". Its block is above the head, so the chain does not hold
    // it, and reporting `dropped` is what keeps the timestamp from claiming
    // otherwise — the demotion itself happens either way.
    expect(row.lastSeenAt ?? null).toBeNull();
  });

  it('resumes below the previous head by the reorg margin, not from where it stopped', async () => {
    const reads: Array<{ fromBlock: bigint; toBlock: bigint }> = [];
    const { indexing } = makeService(() =>
      makeAdapter({
        head: 1100n,
        logs: [],
        onRead: (range) => reads.push(range),
      }),
    );

    await run(indexing, { resumeFrom: 1000n });

    expect(first(reads, 'read').fromBlock).toBe(936n);
    expect(first(reads, 'read').toBlock).toBe(1100n);
  });

  // --- range bounds --------------------------------------------------------

  it('a first run with no history scans the trailing window rather than from genesis', async () => {
    const reads: Array<{ fromBlock: bigint; toBlock: bigint }> = [];
    const { indexing } = makeService(() =>
      makeAdapter({ head: 100_000n, logs: [], onRead: (range) => reads.push(range) }),
    );

    await run(indexing, { resumeFrom: null });

    expect(first(reads, 'read').fromBlock).toBe(95_000n);
  });

  it('clips a gap too large for one run and reports it rather than skipping it silently', async () => {
    const { indexing } = makeService(() => makeAdapter({ head: 1_000_000n, logs: [] }));

    const report = await run(indexing, { resumeFrom: 1_000n });

    expect(report.scannedFrom).toBe('950000');
    expect(report.errors.join(' ')).toMatch(/clipped/);
  });

  it('stops at the budget and reports the range it actually covered', async () => {
    const controller = new AbortController();
    let first = true;
    const { indexing } = makeService(() =>
      makeAdapter({
        head: 6000n,
        logs: [],
        onRead: () => {
          if (first) {
            first = false;
            controller.abort();
          }
        },
      }),
    );

    const report = await run(indexing, { resumeFrom: null, signal: controller.signal });

    expect(report.complete).toBe(false);
    expect(report.scannedTo).toBe('3499');
  });

  // --- the depth sweep -----------------------------------------------------

  it('leaves rows alone whose depth has not changed', async () => {
    const { store, indexing } = makeService(() => makeAdapter({ head: 112n, logs: [] }));
    store.rows.set('tx1', {
      id: 'tx1',
      chainId: CHAIN_ID,
      walletId: 'w1',
      userId: 'u1',
      assetId: 'a1',
      direction: 'in',
      state: 'confirmed',
      txHash: `0x${'3'.repeat(64)}`,
      amountRaw: '1',
      blockNumber: 100n,
      confirmations: 12,
      requiredConfirmations: 12,
      dropCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const report = await run(indexing, { resumeFrom: 112n });

    expect(report.depthChecked).toBe(1);
    expect(report.depthChanged).toBe(0);
    expect(rowById(store, 'tx1').state).toBe('confirmed');
  });

  it('promotes a pending row once the head carries it to the required depth', async () => {
    const { store, indexing } = makeService(() => makeAdapter({ head: 200n, logs: [] }));
    store.rows.set('tx1', {
      id: 'tx1',
      chainId: CHAIN_ID,
      walletId: 'w1',
      userId: 'u1',
      assetId: 'a1',
      direction: 'in',
      state: 'pending',
      txHash: `0x${'4'.repeat(64)}`,
      amountRaw: '1',
      blockNumber: 100n,
      confirmations: 5,
      requiredConfirmations: 12,
      dropCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await run(indexing, { resumeFrom: 200n });

    const row = rowById(store, 'tx1');
    expect(row.state).toBe('confirmed');
    expect(row.confirmations).toBe(100);
  });

  // --- guards ---------------------------------------------------------------

  it('reports a row that carries a block number but no hash rather than inventing one', async () => {
    const { store, indexing } = makeService(() => makeAdapter({ head: 200n, logs: [] }));
    store.rows.set('tx1', {
      id: 'tx1',
      chainId: CHAIN_ID,
      state: 'pending',
      txHash: null,
      blockNumber: 100n,
      confirmations: 5,
      requiredConfirmations: 12,
      updatedAt: new Date(),
    });

    const report = await run(indexing, { resumeFrom: 200n });

    expect(report.errors.join(' ')).toMatch(/block number but no hash/);
    expect(rowById(store, 'tx1').txHash).toBeNull();
  });

  it('does not scan a chain that is not enabled', async () => {
    const { indexing, built } = makeService(() => makeAdapter({ head: 112n, logs: [] }));
    (built.blockchain.forChain as any).mockResolvedValue({
      getTokenTransfers: vi.fn(),
      getBlockNumber: vi.fn(),
    });
    const chainFind = vi.fn(async () => ({ ...CHAIN, enabled: false }));
    (indexing as any).prisma.chain.findUnique = chainFind;

    const report = await run(indexing);

    expect(report.errors.join(' ')).toMatch(/not enabled/);
    expect(built.getTokenTransfers).not.toHaveBeenCalled();
  });
});
