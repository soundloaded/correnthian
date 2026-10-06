import {
  createPublicClient, defineChain, formatUnits, http,
  type Address, type Hex, type PublicClient,
} from 'viem';
import { erc20Abi } from 'viem';
import type {
  Balance, BlockchainAdapter, BuildTransactionRequest, ChainDescriptor,
  FeeEstimate, TransactionRecord, UnsignedTransaction,
} from './adapter.js';
import { RpcPool, type RpcEndpoint } from './rpc.js';
import type { AddressFamily } from './address.js';

/**
 * EVM adapter.
 *
 * Reads are public chain state and belong here. Signing does not: this returns
 * an unsigned payload for the user's device to sign, because Correnthian's
 * servers hold no key and could not sign honestly if they did.
 *
 * Token amounts are handled as decimal strings end to end. `parseUnits` and
 * `formatUnits` do exact decimal arithmetic; a float would silently corrupt an
 * 18-decimal balance before it reached a display.
 */
export class EvmAdapter implements BlockchainAdapter {
  readonly id: string;
  readonly family: AddressFamily = 'evm';

  private readonly pool: RpcPool;
  private readonly descriptor: ChainDescriptor;
  private readonly clients = new Map<string, PublicClient>();

  constructor(descriptor: ChainDescriptor, endpoints: readonly RpcEndpoint[]) {
    this.descriptor = descriptor;
    this.pool = new RpcPool(endpoints);
    this.id = `evm:${descriptor.chainId}`;
  }

  describe(): ChainDescriptor {
    return this.descriptor;
  }

  /** One client per endpoint, so failover does not rebuild transport each call. */
  private client(url: string): PublicClient {
    const existing = this.clients.get(url);
    if (existing) return existing;

    const chain = defineChain({
      id: Number(this.descriptor.chainId) as 1,
      name: this.descriptor.nativeSymbol,
      nativeCurrency: {
        name: this.descriptor.nativeSymbol,
        symbol: this.descriptor.nativeSymbol,
        decimals: this.descriptor.decimals,
      },
      rpcUrls: { default: { http: [url] } },
    });

    const client = createPublicClient({ chain, transport: http(url) });
    this.clients.set(url, client);
    return client;
  }

  private read<T>(fn: (client: PublicClient) => Promise<T>): Promise<T> {
    return this.pool.withFailover((url) => fn(this.client(url)));
  }

  async getBalance(address: string): Promise<Balance> {
    const raw = await this.read((c) => c.getBalance({ address: address as `0x${string}` }));
    return { raw: raw.toString(), decimals: this.descriptor.decimals };
  }

  async getTokenBalance(address: string, contract: string): Promise<Balance> {
    const raw = await this.read((c) =>
      c.readContract({
        address: contract as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      }),
    );
    return { raw: raw.toString(), decimals: 18 };
  }

  /**
   * Batch reads. One failing contract must not fail the whole sweep — an
   * unregistered or non-standard token is normal, not exceptional — so a
   * contract that cannot be read resolves to zero and is left visible as such.
   */
  async getTokenBalances(
    address: string,
    contracts: readonly string[],
  ): Promise<Record<string, Balance>> {
    const out: Record<string, Balance> = {};
    await Promise.all(
      contracts.map(async (contract) => {
        try {
          out[contract] = await this.getTokenBalance(address, contract);
        } catch {
          out[contract] = { raw: '0', decimals: 18 };
        }
      }),
    );
    return out;
  }

  async estimateFee(tx: {
    to: string; value: string; data: string;
  }): Promise<FeeEstimate> {
    const gasPrice = await this.read((c) => c.getGasPrice());
    return {
      // Bigint-safe: gas prices exceed what a double represents exactly.
      raw: (gasPrice * 21000n).toString(),
      nativeSymbol: this.descriptor.nativeSymbol,
    };
  }

  async buildTransaction(req: BuildTransactionRequest): Promise<UnsignedTransaction> {
    // `account` is only included when we know it. Passing a zero address
    // instead would silently estimate against a balance nobody holds.
    const gas = await this.read((c) =>
      // estimateGas is the raw-transaction estimator; estimateContractGas is
      // typed for ABI calls and rejects a plain value transfer.
      c.estimateGas({
        ...(req.from ? { account: req.from as `0x${string}` } : {}),
        to: req.to as `0x${string}` as Address,
        value: BigInt(req.value ?? '0'),
        data: (req.data ?? '0x') as Hex,
      }),
    );

    return {
      to: req.to,
      value: req.value ?? '0',
      data: req.data ?? '0x',
      chainId: Number(this.descriptor.chainId),
      gas: gas.toString(),
    };
  }

  /**
   * Submit a payload the client already signed.
   *
   * Correnthian never produces this value. If a signed payload cannot be
   * produced, that is the architecture working as designed, not a limitation.
   */
  async broadcastTransaction(signed: string): Promise<string> {
    const hash = await this.read((c) => c.sendRawTransaction({ serializedTransaction: signed as `0x${string}` }));
    return hash;
  }

  async getTransaction(hash: string): Promise<TransactionRecord> {
    const tx = await this.read((c) => c.getTransaction({ hash: hash as `0x${string}` }));
    return {
      hash: tx.hash,
      status: tx.blockNumber ? 'confirmed' : 'pending',
      blockNumber: tx.blockNumber ?? null,
      confirmations: 0,
      blockTime: null,
      from: tx.from,
      to: tx.to ?? null,
      valueRaw: tx.value.toString(),
    };
  }

  async getBlockNumber(): Promise<bigint> {
    return this.read((c) => c.getBlockNumber());
  }

  async isHealthy(): Promise<boolean> {
    const { healthy, total } = await this.pool.health(async (url) => {
      const block = await this.client(url).getBlockNumber();
      return block >= 0n;
    });
    // Degraded still answers: one healthy endpoint out of several is usable.
    return healthy > 0 && healthy <= total ? true : false;
  }

  get endpointFailures() {
    return this.pool.recentFailures;
  }
}

/** Display helper for a raw balance, exact rather than float-rounded. */
export function formatBalance(raw: string, decimals: number): string {
  return formatUnits(BigInt(raw), decimals);
}
