import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ObservedTokenTransfer } from '@correnthian/blockchain';
import { TransactionsService } from '../transactions/transactions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BlockchainService } from './blockchain.service.js';

/**
 * How far behind the last completed head a run re-scans.
 *
 * A reorg replaces blocks, so a transaction re-mined onto the new chain lands
 * at a *lower* number than the head we had already indexed past. Without this
 * margin the resume point would start above it and the replacement would never
 * be seen. 64 is comfortably past `DEFAULT_CONFIRMATIONS.evm` (12), which is
 * the depth at which a row has been declared settled.
 */
const REORG_MARGIN_BLOCKS = 64n;

/**
 * Range to scan when there is no usable previous run to resume from — a first
 * deploy, a run that died before it finished, or 200 pruned run records.
 *
 * Stated as a limit rather than discovered, because this is the one place the
 * indexer can silently lose history: a transfer older than this window that we
 * have never seen will not be picked up afterwards.
 */
const SCAN_WINDOW_BLOCKS = 5_000n;

/** Ceiling on one run's range, so a long outage cannot become one huge query. */
const MAX_SCAN_BLOCKS = 50_000n;

/**
 * Blocks per `eth_getLogs`. Providers cap both the range and the result count
 * of a single call, and a rejected call reads the same as an empty one.
 */
const CHUNK_BLOCKS = 2_500n;

/** Rows one run advances in the depth sweep. Bounded so a run ends. */
const DEPTH_BATCH = 500;

/** One chain's worth of work, and the run record's `detail` for it. */
export interface ChainIndexReport {
  chainId: string;
  /** Decimal string — a bigint does not survive the JSON `detail` column. */
  head: string | null;
  scannedFrom: string | null;
  scannedTo: string | null;
  /** False when the budget or the RPC stopped the scan short of `head`. */
  complete: boolean;
  transfersFound: number;
  rowsCreated: number;
  rowsAdvanced: number;
  /** Scanned a token with no registered, enabled asset, and could not file it. */
  skippedUnknownToken: number;
  /** A log involving neither side's wallet — not possible from our own query. */
  skippedNoWallet: number;
  depthChecked: number;
  depthChanged: number;
  errors: string[];
}

export interface IndexChainParams {
  chainId: string;
  /** Head of the last run that completed this chain. Null starts a window scan. */
  resumeFrom: bigint | null;
  signal: AbortSignal;
  now: Date;
}

/**
 * Turns what the chain reports into `Transaction` rows. BE-302.
 *
 * Two sweeps that are separate on purpose, because they answer different
 * questions and one cannot stand in for the other:
 *
 * **The scan** asks *what is new*. It walks a block range and writes one row
 * per transaction hash. Re-running over a range that was already indexed
 * changes nothing: the idempotency is the schema's `@@unique([chainId,
 * txHash])`, enforced by `TransactionsService.recordObserved`, not a guard
 * here. That matters more than it looks — a duplicate deposit row is a
 * double-counted balance.
 *
 * **The depth sweep** asks *what has moved*. Confirmation depth is a function
 * of the head, and the head moves whether or not a transaction's logs appear
 * again. A transfer mined before this service existed, or observed while a
 * reorg was in progress, has to be advanced and demoted here rather than by
 * waiting for its logs to be scanned a second time. This is also where a
 * reorg does its damage: a row whose block number is now *above* the head is
 * on a chain that no longer exists, and it goes back to `pending` with a drop
 * recorded, which is what that looks like from a database.
 *
 * It reads the chain and writes our own tables, and nothing else. There is no
 * signing path and no key material: `getTokenTransfers` observes logs, and a
 * transfer that already happened needs nothing signed to be recorded. The
 * boundary in `CLAUDE.md` holds because this service never touches
 * `wallet-core` at all.
 */
@Injectable()
export class TransactionIndexingService {
  private readonly logger = new Logger(TransactionIndexingService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(BlockchainService) private readonly blockchain: BlockchainService,
    @Inject(TransactionsService) private readonly transactions: TransactionsService,
  ) {}

  /**
   * Chains worth asking about, in one query.
   *
   * A disabled chain is excluded here rather than rejected inside `indexChain`
   * so the run record does not accumulate an error per turn a chain is off.
   */
  async enabledChainIds(): Promise<string[]> {
    const chains = await this.prisma.chain.findMany({
      where: { enabled: true },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    return chains.map((c) => c.id);
  }

  async indexChain(params: IndexChainParams): Promise<ChainIndexReport> {
    const { chainId, resumeFrom, signal, now } = params;
    const report: ChainIndexReport = {
      chainId,
      head: null,
      scannedFrom: null,
      scannedTo: null,
      complete: false,
      transfersFound: 0,
      rowsCreated: 0,
      rowsAdvanced: 0,
      skippedUnknownToken: 0,
      skippedNoWallet: 0,
      depthChecked: 0,
      depthChanged: 0,
      errors: [],
    };

    const chain = await this.prisma.chain.findUnique({ where: { id: chainId } });
    if (!chain) {
      report.errors.push(`Chain ${chainId} is not configured`);
      return report;
    }
    if (!chain.enabled) {
      report.errors.push(`Chain ${chain.name} is not enabled`);
      return report;
    }

    let adapter;
    try {
      adapter = await this.blockchain.forChain(chainId);
    } catch (err) {
      report.errors.push(err instanceof Error ? err.message : String(err));
      return report;
    }

    let head: bigint;
    try {
      head = await adapter.getBlockNumber();
      report.head = head.toString();
    } catch (err) {
      report.errors.push(`head: ${err instanceof Error ? err.message : String(err)}`);
      return report;
    }

    // The two sweeps share `now` and `signal`; the scan runs first so the
    // depth sweep can skip what the scan just wrote rather than observing the
    // same rows twice in one run.
    const touched = new Set<string>();
    try {
      await this.scan({ chain, adapter, resumeFrom, head, signal, now, report, touched });
    } catch (err) {
      report.errors.push(err instanceof Error ? err.message : String(err));
    }

    if (!signal.aborted) {
      try {
        await this.sweepDepth({ chain, head, signal, now, report, skip: touched });
      } catch (err) {
        report.errors.push(`depth: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return report;
  }

  // --- the scan ------------------------------------------------------------

  private async scan(args: {
    chain: { id: string; name: string };
    adapter: Awaited<ReturnType<BlockchainService['forChain']>>;
    resumeFrom: bigint | null;
    head: bigint;
    signal: AbortSignal;
    now: Date;
    report: ChainIndexReport;
    touched: Set<string>;
  }): Promise<void> {
    const { chain, adapter, resumeFrom, head, signal, now, report, touched } = args;

    // Only what can actually resolve: an address nobody registered, or a token
    // with no enabled asset, produces a log we are structurally unable to file.
    const wallets = await this.prisma.wallet.findMany({
      where: { chainId: chain.id },
      select: { id: true, address: true },
    });
    const assets = await this.prisma.asset.findMany({
      where: { chainId: chain.id, enabled: true, NOT: { contractAddress: '' } },
      select: { id: true, assetId: true, contractAddress: true },
    });
    if (wallets.length === 0 || assets.length === 0) {
      report.scannedFrom = null;
      report.scannedTo = head.toString();
      report.complete = true;
      return;
    }

    const walletByAddress = new Map(wallets.map((w) => [w.address.toLowerCase(), w.id]));
    const assetByContract = new Map(
      assets.map((a) => [a.contractAddress.toLowerCase(), a]),
    );

    const { from, clipped } = this.startBlock(resumeFrom, head);
    report.scannedFrom = from.toString();

    let cursor = from;
    let completedTo: bigint | null = null;

    while (cursor <= head) {
      if (signal.aborted) break;
      const to = cursor + CHUNK_BLOCKS - 1n > head ? head : cursor + CHUNK_BLOCKS - 1n;

      const transfers = await adapter.getTokenTransfers({
        addresses: wallets.map((w) => w.address),
        fromBlock: cursor,
        toBlock: to,
      });

      report.transfersFound += transfers.length;
      await this.fileTransfers({
        transfers,
        walletByAddress,
        assetByContract,
        head,
        now,
        report,
        touched,
      });

      completedTo = to;
      cursor = to + 1n;
    }

    if (completedTo !== null) report.scannedTo = completedTo.toString();
    report.complete = !signal.aborted && completedTo !== null && completedTo >= head;

    if (clipped) {
      // Not a failure, but a gap: transfers below this point were never seen
      // and never will be. It goes in the run record so the hole is visible
      // rather than discoverable only by a user asking where their deposit is.
      report.errors.push(
        `Range clipped to ${MAX_SCAN_BLOCKS} block(s); blocks below ${from} were not scanned`,
      );
    }
  }

  /**
   * Where this run starts.
   *
   * Resuming from the last completed head keeps the scan proportional to the
   * cadence rather than to the age of the deployment, and re-scans the margin
   * behind it so a shallow reorg's replacement is caught. With no history to
   * resume from it falls back to a fixed trailing window, which is the honest
   * limit of what a first run can promise.
   */
  private startBlock(resumeFrom: bigint | null, head: bigint): {
    from: bigint;
    clipped: boolean;
  } {
    // A resume point *above* the head means the chain moved backwards under
    // us: a reorg, or an RPC endpoint on a shorter fork. Blocks above the new
    // head no longer exist, and the replacement for whatever we indexed there
    // sits below it, so the scan restarts under the head rather than starting
    // somewhere it can no longer reach.
    const regressed = resumeFrom !== null && resumeFrom > head;
    const wanted =
      resumeFrom === null
        ? head - SCAN_WINDOW_BLOCKS
        : regressed
          ? head - REORG_MARGIN_BLOCKS
          : resumeFrom - REORG_MARGIN_BLOCKS;

    let floored = wanted < 0n ? 0n : wanted;
    // Never start above the head: an empty range is indistinguishable from a
    // scan that found nothing, and would record a cursor covering blocks that
    // were never read.
    if (floored > head) floored = head;
    if (head - floored <= MAX_SCAN_BLOCKS) return { from: floored, clipped: false };
    return { from: head - MAX_SCAN_BLOCKS, clipped: true };
  }

  /**
   * Turn observed logs into rows, one row per transaction hash.
   *
   * Grouped by hash because the schema allows exactly one row per
   * `(chainId, txHash)`: a router that moves two assets in one transaction has
   * two logs and one row, so the amounts that share an asset and a wallet are
   * summed and everything else is counted in `metadata` rather than dropped
   * without trace.
   */
  private async fileTransfers(args: {
    transfers: ObservedTokenTransfer[];
    walletByAddress: Map<string, string>;
    assetByContract: Map<string, { id: string; assetId: string; contractAddress: string }>;
    head: bigint;
    now: Date;
    report: ChainIndexReport;
    touched: Set<string>;
  }): Promise<void> {
    const { transfers, walletByAddress, assetByContract, head, now, report, touched } = args;
    if (transfers.length === 0) return;

    const groups = new Map<string, ObservedTokenTransfer[]>();
    for (const t of transfers) {
      const list = groups.get(t.txHash);
      if (list) list.push(t);
      else groups.set(t.txHash, [t]);
    }

    for (const group of groups.values()) {
      const resolved: Array<{
        transfer: ObservedTokenTransfer;
        walletId: string;
        assetKey: string;
        direction: 'in' | 'out' | 'internal';
      }> = [];

      for (const transfer of group) {
        const asset = assetByContract.get(transfer.token.toLowerCase());
        const fromWallet = walletByAddress.get(transfer.from.toLowerCase());
        const toWallet = walletByAddress.get(transfer.to.toLowerCase());

        if (!asset) {
          report.skippedUnknownToken += 1;
          continue;
        }
        if (!fromWallet && !toWallet) {
          report.skippedNoWallet += 1;
          continue;
        }

        // Both sides ours means value moved between two accounts of the same
        // platform, which is `internal` rather than a deposit and a withdrawal.
        const direction: 'in' | 'out' | 'internal' =
          fromWallet && toWallet ? 'internal' : toWallet ? 'in' : 'out';
        resolved.push({
          transfer,
          walletId: (toWallet ?? fromWallet) as string,
          assetKey: asset.assetId,
          direction,
        });
      }

      // Prefer the leg that brought value in: that is the row an account
      // holder is looking for, and the hash can only be attached to one.
      const primary = resolved.find((r) => r.direction !== 'out') ?? resolved[0];
      if (!primary) continue;

      const sameLeg = resolved.filter(
        (r) => r.assetKey === primary.assetKey && r.walletId === primary.walletId,
      );
      const amountRaw = sameLeg
        .reduce((sum, r) => sum + BigInt(r.transfer.amountRaw), 0n)
        .toString();

      const metadata: Record<string, unknown> = { logIndex: primary.transfer.logIndex };
      if (group.length > 1) {
        // The schema's one-row-per-hash rule makes a partial figure possible
        // here, so it says so rather than presenting a summed amount as total.
        metadata['transferCount'] = group.length;
        metadata['otherTransfers'] = group.length - sameLeg.length;
      }

      try {
        const result = await this.transactions.recordObserved(
          {
            walletId: primary.walletId,
            assetKey: primary.assetKey,
            txHash: primary.transfer.txHash,
            direction: primary.direction,
            destination: primary.direction === 'in' ? null : primary.transfer.to,
            amountRaw,
            blockNumber: primary.transfer.blockNumber,
            confirmations: this.confirmationsAt(head, primary.transfer.blockNumber),
            metadata,
          },
          now,
        );
        touched.add(result.id);
        if (result.created) report.rowsCreated += 1;
        else if (result.changed) report.rowsAdvanced += 1;
      } catch (err) {
        // One unfileable hash must not abandon the rest of the range.
        report.errors.push(
          `${primary.transfer.txHash}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  // --- the depth sweep -----------------------------------------------------

  /**
   * Move rows that already exist to the depth the current head implies.
   *
   * Ordered by `updatedAt` ascending so a row is never starved by a busier
   * one: every row this touches is written, which pushes it to the back of the
   * queue for the next run.
   */
  private async sweepDepth(args: {
    chain: { id: string };
    head: bigint;
    signal: AbortSignal;
    now: Date;
    report: ChainIndexReport;
    skip: Set<string>;
  }): Promise<void> {
    const { chain, head, signal, now, report, skip } = args;

    const rows = await this.prisma.transaction.findMany({
      where: {
        chainId: chain.id,
        state: { in: ['broadcast', 'pending', 'confirmed'] },
        blockNumber: { not: null },
        id: { notIn: [...skip] },
      },
      orderBy: { updatedAt: 'asc' },
      take: DEPTH_BATCH,
      select: {
        id: true, txHash: true, state: true, confirmations: true,
        requiredConfirmations: true, blockNumber: true,
      },
    });

    for (const row of rows) {
      if (signal.aborted) break;
      report.depthChecked += 1;
      if (row.blockNumber === null) continue;
      if (!row.txHash) {
        // `observe` binds a row to one hash for life and refuses a blank one,
        // so there is no safe observation to make. A block number without a
        // hash cannot be written by any path here, which makes this a
        // corruption report rather than a routine skip.
        report.errors.push(`Transaction ${row.id} has a block number but no hash`);
        continue;
      }

      const orphaned = row.blockNumber > head;
      const confirmations = orphaned ? 0 : this.confirmationsAt(head, row.blockNumber);
      const settled = confirmations >= row.requiredConfirmations;

      // Nothing to do unless the sweep would actually move the row. A run that
      // rewrites every row it reads makes `affected` meaningless and puts
      // `updatedAt` — which is what orders this query — in constant motion.
      const moves =
        confirmations !== row.confirmations ||
        (settled && row.state !== 'confirmed') ||
        (!settled && row.state === 'confirmed');
      if (!moves) continue;

      await this.transactions.observe(
        row.id,
        { id: 'system', role: 'system' },
        {
          txHash: row.txHash,
          confirmations,
          blockNumber: row.blockNumber.toString(),
          outcome: orphaned ? 'dropped' : 'seen',
        },
        now,
      );
      report.depthChanged += 1;
    }
  }

  private confirmationsAt(head: bigint, blockNumber: bigint): number {
    const depth = head - blockNumber;
    return depth > 0n ? Number(depth) : 0;
  }
}
