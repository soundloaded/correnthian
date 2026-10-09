import { describe, expect, it, vi } from 'vitest';
import type { ChainIndexReport } from '../transactions/transaction-indexing.service.js';
import { IndexTransactionsJob } from './index-transactions.job.js';
import type { JobRunView as RunView } from './job-run.store.js';
import type { JobContext } from './job.js';

const NOW = new Date('2026-10-08T12:00:00.000Z');

function ctx(signal?: AbortSignal): JobContext {
  return {
    now: NOW,
    deadline: new Date(NOW.getTime() + 50_000),
    signal: signal ?? new AbortController().signal,
    trigger: 'schedule',
  };
}

function report(over: Partial<ChainIndexReport> = {}): ChainIndexReport {
  return {
    chainId: 'evm:1',
    head: '1100',
    scannedFrom: '936',
    scannedTo: '1100',
    complete: true,
    transfersFound: 1,
    rowsCreated: 1,
    rowsAdvanced: 0,
    skippedUnknownToken: 0,
    skippedNoWallet: 0,
    depthChecked: 3,
    depthChanged: 2,
    hashChecked: 0,
    hashMined: 0,
    hashDropped: 0,
    errors: [],
    ...over,
  };
}

function makeJob(options?: {
  history?: RunView[];
  indexChain?: (params: { resumeFrom: bigint | null }) => Promise<ChainIndexReport>;
  chainIds?: string[];
}) {
  const runs = {
    history: vi.fn(async () => options?.history ?? []),
  };
  const indexing = {
    enabledChainIds: vi.fn(async () => options?.chainIds ?? ['evm:1']),
    indexChain: vi.fn(async (params: { resumeFrom: bigint | null }) =>
      options?.indexChain ? options.indexChain(params) : report()),
  };
  const job = new IndexTransactionsJob(indexing as never, runs as never);
  return { job, indexing, runs };
}

const succeeded = (detail: Record<string, unknown>): RunView =>
  ({
    id: 'r1', jobName: 'blockchain.index-transactions', instanceId: 'i1',
    trigger: 'schedule', startedAt: NOW.toISOString(), finishedAt: NOW.toISOString(), durationMs: 1,
    outcome: 'succeeded', affected: 1, detail, error: null,
  }) as unknown as RunView;

describe('IndexTransactionsJob', () => {
  it('starts a first run from the window rather than from genesis', async () => {
    const { job, indexing } = makeJob({ history: [] });

    await job.run(ctx());

    expect(indexing.indexChain).toHaveBeenCalledWith(
      expect.objectContaining({ resumeFrom: null }),
    );
  });

  it('resumes each chain from the head its last successful run recorded', async () => {
    const { job, indexing } = makeJob({
      history: [succeeded({ cursor: { 'evm:1': '936' } })],
    });

    await job.run(ctx());

    expect(indexing.indexChain).toHaveBeenCalledWith(
      expect.objectContaining({ resumeFrom: 936n }),
    );
  });

  it('ignores a failed run, whose head it did not actually scan', async () => {
    const failed: RunView = {
      id: 'r0', jobName: 'blockchain.index-transactions', instanceId: 'i1',
      trigger: 'schedule', startedAt: NOW.toISOString(), finishedAt: NOW.toISOString(), durationMs: 1,
      outcome: 'failed', affected: 0,
      detail: { cursor: { 'evm:1': '500000' } },
      error: 'rpc down',
    };
    const { job, indexing } = makeJob({ history: [failed] });

    await job.run(ctx());

    // Resuming from 500000 would skip every block between the truth and that
    // number. Falling back to the window re-does work instead.
    expect(indexing.indexChain).toHaveBeenCalledWith(
      expect.objectContaining({ resumeFrom: null }),
    );
  });

  it('records a cursor only for the chains it actually covered', async () => {
    let call = 0;
    const { job } = makeJob({
      chainIds: ['evm:1', 'evm:137'],
      indexChain: async () => {
        call += 1;
        // One chain indexed, the other unreachable. The cursor must carry only
        // what was really read — advancing the unreachable chain would skip
        // every block between here and there, silently.
        return call === 1
          ? report()
          : report({
              chainId: 'evm:137',
              scannedTo: null,
              complete: false,
              errors: ['rpc down'],
            });
      },
    });

    const outcome = await job.run(ctx());
    const detail = outcome.detail as Record<string, unknown>;

    expect(detail['cursor']).toEqual({ 'evm:1': '1100' });
    expect(detail['errors']).toEqual(['evm:137: rpc down']);
    expect(detail['incomplete']).toEqual(['evm:137']);
  });

  it('reports a run in which nothing at all could be scanned', async () => {
    const { job } = makeJob({
      indexChain: async () => report({ scannedTo: null, complete: false, errors: ['no endpoint'] }),
    });

    await expect(job.run(ctx())).rejects.toThrow(/No chain could be scanned/);
  });

  it('counts rows it created, advanced and moved with depth', async () => {
    const { job } = makeJob({
      indexChain: async () => report({ rowsCreated: 4, rowsAdvanced: 2, depthChanged: 3 }),
    });

    const outcome = await job.run(ctx());

    expect(outcome.affected).toBe(9);
    expect(outcome.detail).toMatchObject({ created: 4, advanced: 2, depthChanged: 3 });
  });

  it('passes the run clock through, rather than reading the wall clock', async () => {
    const seen: Date[] = [];
    const { job } = makeJob({
      indexChain: async ({ resumeFrom }) => {
        seen.push(NOW);
        void resumeFrom;
        return report();
      },
    });

    await job.run(ctx());
    expect(seen).toEqual([NOW]);
  });

  it('stops scanning chains once the budget is gone', async () => {
    const controller = new AbortController();
    controller.abort();
    const { job, indexing } = makeJob({ chainIds: ['evm:1', 'evm:137'] });

    await job.run(ctx(controller.signal));

    expect(indexing.indexChain).not.toHaveBeenCalled();
  });
});
