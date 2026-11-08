import { EvmAdapter, RpcReverted } from '@correnthian/blockchain';
import { Inject, Injectable } from '@nestjs/common';
import { BlockchainService } from '../blockchain/blockchain.service.js';
import { AppError } from '../common/errors.js';

/**
 * How much `spender` may pull of `token` from `owner`.
 *
 * A port so a test can stub the read. The production reader calls
 * `EvmAdapter.readContract`, which turns a contract revert into
 * `RpcReverted` before the pool can quarantine the endpoint. An allowance
 * revert is the token's reply, not an outage, and every other URL would
 * revert the same call.
 */
export interface TokenAllowance {
  allowance(token: `0x${string}`, owner: `0x${string}`, spender: `0x${string}`): Promise<bigint>;
}

export const TOKEN_ALLOWANCE = Symbol('TOKEN_ALLOWANCE');

const ERC20_ALLOWANCE_ABI = [
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: 'remaining', type: 'uint256' }],
  },
] as const;

@Injectable()
export class EvmTokenAllowance implements TokenAllowance {
  constructor(@Inject(BlockchainService) private readonly chains: BlockchainService) {}

  async allowance(
    token: `0x${string}`,
    owner: `0x${string}`,
    spender: `0x${string}`,
  ): Promise<bigint> {
    const adapter = await this.chains.forChain('1');
    if (!(adapter instanceof EvmAdapter)) {
      throw AppError.providerUnavailable('The token allowance could not be read');
    }

    try {
      const raw = await adapter.readContract({
        address: token,
        abi: ERC20_ALLOWANCE_ABI,
        functionName: 'allowance',
        args: [owner, spender],
      });
      if (typeof raw !== 'bigint') {
        throw AppError.badRequest('The token allowance could not be read');
      }
      return raw;
    } catch (err) {
      if (err instanceof AppError) throw err;
      // `RpcReverted` already left the endpoint alone. Do not repeat the
      // call, and do not put a node message — which can carry a URL — on
      // the response.
      if (err instanceof RpcReverted) {
        throw AppError.badRequest('The token allowance could not be read');
      }
      const message = err instanceof Error ? err.message : String(err);
      if (/All \d+ RPC endpoint\(s\) failed/.test(message)) {
        throw AppError.providerUnavailable(
          'The chain could not be reached while reading the token allowance',
        );
      }
      throw AppError.badRequest('The token allowance could not be read');
    }
  }
}
