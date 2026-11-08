import { EvmAdapter, RpcReverted, type ChainDescriptor } from '@correnthian/blockchain';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../common/errors.js';
import { EvmTokenAllowance } from './token-allowance.js';

/**
 * Allowance goes through `EvmAdapter.readContract`. That method turns an
 * execution revert into `RpcReverted` before the pool can quarantine the
 * endpoint. A path that called `read` around a raw `eth_call` would take
 * the shared chain-1 pool offline for 30 seconds on a token that reverts.
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

const TOKEN = `0x${'11'.repeat(20)}` as const;
const OWNER = `0x${'aa'.repeat(20)}` as const;
const SPENDER = `0x${'33'.repeat(20)}` as const;

function reader(readContract: ReturnType<typeof vi.fn>) {
  const adapter = new EvmAdapter(descriptor, [{ url: 'http://rpc.test', weight: 0 }]);
  vi.spyOn(adapter, 'readContract').mockImplementation(readContract as never);
  const chains = { forChain: vi.fn(async () => adapter) };
  return { allowance: new EvmTokenAllowance(chains as never), adapter };
}

describe('EvmTokenAllowance', () => {
  it('reads allowance through readContract and does not broadcast', async () => {
    const readContract = vi.fn(async () => 0n);
    const { allowance, adapter } = reader(readContract);
    await expect(allowance.allowance(TOKEN, OWNER, SPENDER)).resolves.toBe(0n);
    expect(readContract).toHaveBeenCalledWith({
      address: TOKEN,
      abi: expect.any(Array),
      functionName: 'allowance',
      args: [OWNER, SPENDER],
    });
    expect(adapter.endpointFailures).toEqual([]);
  });

  it('turns a contract revert into a client error that contains no URL', async () => {
    const readContract = vi.fn(async () => {
      throw new RpcReverted('execution reverted at http://rpc.internal/key');
    });
    const { allowance } = reader(readContract);
    const err = await allowance.allowance(TOKEN, OWNER, SPENDER).catch((caught: unknown) => caught);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(400);
    expect((err as AppError).message).not.toMatch(/https?:|rpc\.internal/i);
  });
});
