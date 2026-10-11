import { describe, expect, it, vi } from 'vitest';
import { IndexingService } from './indexing.service.js';

/**
 * Sync errors are reported without endpoints — DEF-023.
 *
 * The adapter's failure text is viem verbatim: `URL: http://…` on the second
 * line plus request bodies. `errors[]` travels in the 200 response body and
 * into audit metadata, so passing it through publishes our RPC topology to
 * any signed-in account that syncs. The failure is recorded; the internals
 * are not — same rule as the transaction engine's `summariseError`.
 */
const VIEM_FAILURE =
  'All 1 RPC endpoint(s) failed for this read. Last error: HTTP request failed.\n\n' +
  'URL: http://127.0.0.1:56910/\nRequest body: {"method":"eth_getBalance"}\n\nDetails: fetch failed\nVersion: viem@2.57.3';

function setup() {
  const prisma = {
    wallet: {
      findFirst: vi.fn(async () => ({ id: 'w1', userId: 'u1', address: '0xabc', chainId: '1' })),
    },
    chain: {
      findUnique: vi.fn(async () => ({ id: '1', enabled: true })),
    },
    asset: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
    },
    walletAccount: { upsert: vi.fn() },
  };
  const blockchain = {
    forChain: vi.fn(async () => ({
      getBalance: vi.fn(async () => { throw new Error(VIEM_FAILURE); }),
      getTokenBalance: vi.fn(),
    })),
  };
  const audit = { record: vi.fn(async () => undefined) };
  return new IndexingService(prisma as never, blockchain as never, audit as never);
}

describe('sync error reporting', () => {
  it('strips endpoints and request bodies from reported errors', async () => {
    const out = await setup().syncWallet('u1', 'w1');

    expect(out.errors).toHaveLength(1);
    expect(out.errors[0]).not.toContain('127.0.0.1');
    expect(out.errors[0]).not.toContain('URL:');
    expect(out.errors[0]).not.toContain('eth_getBalance');
    expect(out.errors[0]?.length).toBeLessThanOrEqual(200);
  });

  it('still says the read failed', async () => {
    const out = await setup().syncWallet('u1', 'w1');

    expect(out.errors[0]).toMatch(/failed/i);
  });
});
