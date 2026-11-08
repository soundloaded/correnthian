import {
  BaseError, createPublicClient, decodeFunctionData, defineChain, encodeAbiParameters,
  ExecutionRevertedError, formatUnits, getAddress, hexToBigInt, http, keccak256,
  parseTransaction, recoverTransactionAddress, toHex, TransactionNotFoundError,
  type Address, type Hex, type PublicClient, type StateOverride, type TransactionSerialized,
} from 'viem';
import { encodeFunctionData, erc20Abi, getAbiItem } from 'viem';
import type {
  Balance, BlockchainAdapter, BuildTransactionRequest, ChainDescriptor,
  FeeEstimate, ObservedTokenTransfer, SignedTransactionFacts, TransactionRecord,
  UnsignedTransaction,
} from './adapter.js';
import { RpcAbsent, RpcPool, RpcReverted, type RpcEndpoint } from './rpc.js';
import type { AddressFamily } from './address.js';

/**
 * Did the node answer "I do not have this transaction"?
 *
 * Two shapes, because nodes differ: `viem` raises `TransactionNotFoundError`
 * when the result is `null`, and a node that answers with a JSON-RPC error
 * instead of a `null` result carries the same meaning in its message. Both are
 * read as absence. Anything else is rethrown — an unreachable endpoint, a
 * malformed response, a timeout — none of which say anything about the
 * transaction, and all of which must stay with the pool so it can fail over
 * and quarantine.
 */
function isTransactionAbsent(err: unknown): boolean {
  if (err instanceof TransactionNotFoundError) return true;
  return (
    err instanceof Error &&
    /transaction[^.]{0,80}(could not be found|not found)/i.test(err.message)
  );
}

/**
 * Did the node answer with a contract revert?
 *
 * `viem` wraps an `eth_call` that reverts (JSON-RPC code 3, or a message the
 * node marks as execution reverted) in `ExecutionRevertedError`. That is the
 * contract's reply. A transport error, an HTTP failure, and a node that
 * returns an internal error are not in that chain and must stay with the
 * pool so it can fail over.
 */
function isContractRevert(err: unknown): boolean {
  if (!(err instanceof BaseError)) return false;
  // `estimateGas` and a raw `eth_call` do not share one error class. viem wraps
  // the former in `ExecutionRevertedError`. A request that has not been wrapped
  // still carries JSON-RPC code 3, which is the same reply: the node executed
  // the call and the contract refused it.
  return (
    err.walk((cause) => {
      if (cause instanceof ExecutionRevertedError) return true;
      return (
        typeof cause === 'object' &&
        cause !== null &&
        'code' in cause &&
        (cause as { code?: unknown }).code === 3
      );
    }) !== null
  );
}

/**
 * A value `allowance` cannot already be holding. The probe writes it into a
 * candidate slot and asks `allowance` whether that slot is the one it reads.
 */
const ALLOWANCE_PROBE = (1n << 128n) - 1n;

/** How many mapping bases to try. USDC's `allowed` sits at 11; this covers it. */
const ALLOWANCE_SLOT_SEARCH = 32;

/**
 * Storage key of `allowed[owner][spender]` when that nested mapping lives at
 * `base`. Standard ERC-20 layout, including FiatToken: outer key is the
 * owner, inner key is the spender.
 */
function erc20AllowanceSlot(owner: Address, spender: Address, base: number): Hex {
  const inner = keccak256(
    encodeAbiParameters(
      [{ type: 'address' }, { type: 'uint256' }],
      [owner, BigInt(base)],
    ),
  );
  return keccak256(
    encodeAbiParameters(
      [{ type: 'address' }, { type: 'bytes32' }],
      [spender, inner],
    ),
  );
}

/**
 * A nonce the server already chose for a second unsigned call. Anything
 * else is refused: falling through to `getTransactionCount` would hand
 * the second call the same nonce as the first.
 */
function assignedNonceOf(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('nonce must be a non-negative integer');
  }
  return value;
}

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
  /**
   * Allowance mapping base slot, per token. The first successful probe
   * fills it. Layouts differ — USDC is not an OpenZeppelin ERC-20 — and
   * guessing one slot would estimate the swap against state that still
   * refuses `transferFrom`.
   */
  private readonly allowanceSlots = new Map<string, number>();

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

  assemblePayload(req: BuildTransactionRequest): { to: string; value: string; data: string } {
    if (req.token === undefined) {
      return { to: req.to, value: req.value ?? '0', data: req.data ?? '0x' };
    }

    if (req.data !== undefined) {
      // Both is ambiguous: either the caller means the contract call they
      // wrote, or the transfer they asked for. Refusing beats picking.
      throw new Error('a token transfer cannot be combined with explicit data');
    }
    // Base units, integer: `parseUnits`-style fractions of a base unit
    // cannot be encoded into a uint256, and rounding them silently would
    // move an amount the caller never asked for.
    if (!req.amount || !/^[1-9]\d*$/.test(req.amount)) {
      throw new Error('amount must be a positive integer in base units');
    }
    return {
      to: req.token,
      value: '0',
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [req.to as Address, BigInt(req.amount)],
      }),
    };
  }

  /**
   * State in which every prior call has already landed.
   *
   * Today that is an ERC-20 `approve`. SwapRouter02 pulls the token with
   * `transferFrom`, and the approve is still unsigned, so estimating the
   * swap against the chain as it is reverts. The allowance slot is found
   * rather than hardcoded: one wrong slot leaves the real allowance at
   * zero and the estimate reverts the same way.
   *
   * A prior call this cannot apply is `RpcReverted`. Estimating without it
   * would ask the node a question we already know fails, and a plain error
   * would quarantine the endpoint for a call every URL refuses.
   */
  private async priorCallState(
    client: PublicClient,
    req: BuildTransactionRequest,
  ): Promise<StateOverride> {
    if (!req.from || !req.priorCalls?.length) throw new RpcReverted();
    const owner = getAddress(req.from);
    const byToken = new Map<Address, Array<{ slot: Hex; value: Hex }>>();

    for (const call of req.priorCalls) {
      let decoded;
      try {
        decoded = decodeFunctionData({ abi: erc20Abi, data: call.data as Hex });
      } catch {
        throw new RpcReverted();
      }
      if (decoded.functionName !== 'approve') throw new RpcReverted();
      const spender = getAddress(decoded.args[0]);
      const amount = decoded.args[1];
      const token = getAddress(call.to);
      const base = await this.allowanceBaseSlot(client, token, owner, spender);
      const slots = byToken.get(token) ?? [];
      slots.push({
        slot: erc20AllowanceSlot(owner, spender, base),
        value: toHex(amount, { size: 32 }),
      });
      byToken.set(token, slots);
    }

    return [...byToken.entries()].map(([address, stateDiff]) => ({ address, stateDiff }));
  }

  /** The mapping base `allowance(owner, spender)` actually reads for `token`. */
  private async allowanceBaseSlot(
    client: PublicClient,
    token: Address,
    owner: Address,
    spender: Address,
  ): Promise<number> {
    const cached = this.allowanceSlots.get(token.toLowerCase());
    if (cached !== undefined) return cached;

    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'allowance',
      args: [owner, spender],
    });
    const word = toHex(ALLOWANCE_PROBE, { size: 32 });

    for (let slot = 0; slot < ALLOWANCE_SLOT_SEARCH; slot += 1) {
      const storageKey = erc20AllowanceSlot(owner, spender, slot);
      let raw: unknown;
      try {
        raw = await client.request({
          method: 'eth_call',
          params: [
            { to: token, data },
            'latest',
            { [token]: { stateDiff: { [storageKey]: word } } },
          ],
        });
      } catch (err) {
        if (isContractRevert(err)) continue;
        throw err;
      }
      if (typeof raw !== 'string' || raw === '0x') continue;
      try {
        if (hexToBigInt(raw as Hex) !== ALLOWANCE_PROBE) continue;
      } catch {
        continue;
      }
      this.allowanceSlots.set(token.toLowerCase(), slot);
      return slot;
    }

    throw new RpcReverted();
  }

  async buildTransaction(req: BuildTransactionRequest): Promise<UnsignedTransaction> {
    const { to, value, data } = this.assemblePayload(req);
    const assignedNonce = assignedNonceOf(req.nonce);

    // All three in one `read`, so failover retries the assembly as a unit —
    // a nonce from one endpoint and gas from a quarantined one is how a
    // payload gets assembled from two different views of the chain.
    //
    // Fee estimation is `estimateFeesPerGas` with no fallback: on a chain
    // where it cannot be answered, building fails rather than returning a
    // payload with an invented ceiling. A device signing a fee nobody
    // calculated is worse than a request that errored.
    //
    // An execution revert from `estimateGas` is the contract's reply. It is
    // thrown as `RpcReverted` before the pool can quarantine the endpoint
    // or ask the next URL: every node reverts the same call.
    const { gas, nonce, fees } = await this.read(async (c) => {
      const stateOverride = req.priorCalls?.length
        ? await this.priorCallState(c, req)
        : undefined;
      try {
        const [gasEstimate, nonceEstimate, feeEstimate] = await Promise.all([
          // estimateGas is the raw-transaction estimator; estimateContractGas is
          // typed for ABI calls and rejects a plain value transfer.
          c.estimateGas({
            ...(req.from ? { account: req.from as `0x${string}` } : {}),
            to: to as `0x${string}` as Address,
            value: BigInt(value),
            data: data as Hex,
            ...(stateOverride ? { stateOverride } : {}),
          }),
          // `pending`, not `latest`: two sends from one wallet in flight would
          // otherwise be handed the same nonce, and the second would replace
          // the first. A server-assigned nonce skips that read: the node has
          // not seen the earlier unsigned transaction, so its count is the
          // first call's nonce and the next call must take the one after it.
          assignedNonce !== undefined
            ? Promise.resolve(assignedNonce)
            : req.from
              ? c.getTransactionCount({
                  address: req.from as `0x${string}`,
                  blockTag: 'pending',
                })
              : Promise.resolve(undefined),
          c.estimateFeesPerGas(),
        ]);

        return {
          gas: gasEstimate,
          nonce: nonceEstimate,
          fees: feeEstimate,
        };
      } catch (err) {
        if (isContractRevert(err)) throw new RpcReverted();
        throw err;
      }
    });

    return {
      to,
      value,
      data,
      chainId: Number(this.descriptor.chainId),
      gas: gas.toString(),
      ...(nonce !== undefined ? { nonce } : {}),
      maxFeePerGas: fees.maxFeePerGas.toString(),
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas.toString(),
    };
  }

  /**
   * Submit a payload the client already signed.
   *
   * Correnthian never produces this value. If a signed payload cannot be
   * produced, that is the architecture working as designed, not a limitation.
   */
  async decodeSignedTransaction(signed: string): Promise<SignedTransactionFacts> {
    if (!/^0x[0-9a-fA-F]+$/.test(signed)) {
      throw new Error('Not a hex-encoded payload');
    }

    // `parseTransaction` is positional in this viem: an object argument is
    // handed to the type sniffer as if it were bytes.
    const parsed = parseTransaction(signed as TransactionSerialized);
    const from = await recoverTransactionAddress({
      serializedTransaction: signed as TransactionSerialized,
    });

    return {
      // A payload with no chain id is not "any chain" — it is a payload this
      // platform's assemblies never produce, and 0 fails every comparison a
      // caller makes against a configured chain.
      chainId: parsed.chainId ?? 0,
      from,
      to: parsed.to ?? null,
      value: (parsed.value ?? 0n).toString(),
      nonce: parsed.nonce ?? 0,
      data: parsed.data ?? '0x',
    };
  }

  async broadcastTransaction(signed: string): Promise<string> {
    const hash = await this.read((c) => c.sendRawTransaction({ serializedTransaction: signed as `0x${string}` }));
    return hash;
  }

  async getTransaction(hash: string): Promise<TransactionRecord | null> {
    try {
      return await this.read(async (c) => {
        let tx;
        try {
          tx = await c.getTransaction({ hash: hash as `0x${string}` });
        } catch (err) {
          // Raised as `RpcAbsent` so the pool moves to the next endpoint
          // without quarantining this one: a node that correctly reports an
          // absence is a node that worked. `DEF-020` is what happens when the
          // two are told apart at the wrong layer — both arrived here as
          // "All N RPC endpoint(s) failed for this read."
          if (isTransactionAbsent(err)) throw new RpcAbsent(`transaction ${hash}`);
          throw err;
        }

        const base = {
          hash: tx.hash,
          blockNumber: tx.blockNumber ?? null,
          from: tx.from,
          to: tx.to ?? null,
          valueRaw: tx.value.toString(),
        };

        if (tx.blockNumber === null) return { ...base, status: 'pending' as const };

        // Receipt or nothing. Not finding it here is a race we cannot rule
        // out, so it is thrown and the pool may ask elsewhere — guessing
        // `confirmed` would answer a question this did not answer.
        const receipt = await c.getTransactionReceipt({ hash: tx.hash as `0x${string}` });
        return {
          ...base,
          status: receipt.status === 'success' ? ('confirmed' as const) : ('failed' as const),
        };
      });
    } catch (err) {
      // Every endpoint said it is not there. That is the answer, not an error.
      if (err instanceof RpcAbsent) return null;
      throw err;
    }
  }

  async getTokenTransfers(params: {
    addresses: readonly string[];
    fromBlock: bigint;
    toBlock: bigint;
  }): Promise<ObservedTokenTransfer[]> {
    const { addresses, fromBlock, toBlock } = params;
    if (addresses.length === 0 || toBlock < fromBlock) return [];

    // Two calls, not one. `eth_getLogs` constrains one indexed position per
    // filter, so "the watcher is the sender OR the receiver" cannot be one
    // request; `args.from` and `args.to` are the two sides of it.
    const watch = [...new Set(addresses.map((a) => a.toLowerCase()))] as Address[];
    const event = getAbiItem({ abi: erc20Abi, name: 'Transfer' });

    const [incoming, outgoing] = await Promise.all([
      this.read((c) => c.getLogs({ event, args: { from: watch }, fromBlock, toBlock })),
      this.read((c) => c.getLogs({ event, args: { to: watch }, fromBlock, toBlock })),
    ]);

    const seen = new Set<string>();
    const transfers: ObservedTokenTransfer[] = [];

    for (const log of [...incoming, ...outgoing]) {
      if (!log.transactionHash || log.blockNumber === null) continue;

      // A transfer between two watched addresses matches both queries. One row
      // per log, or a wallet watching itself would double-count every move.
      const key = `${log.transactionHash}:${log.logIndex ?? 0}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // ERC-721 shares this topic0 but indexes the token id, so its `data` is
      // empty and `value` cannot be decoded. `strict` is false for exactly this
      // reason: an un-decodable log is skipped, not thrown — one token we
      // cannot read must not fail the page for the fifty we can.
      const args = log.args as { from?: string; to?: string; value?: bigint } | undefined;
      if (!args?.value || !args.from || !args.to) continue;

      transfers.push({
        txHash: log.transactionHash,
        logIndex: log.logIndex ?? 0,
        blockNumber: log.blockNumber,
        token: log.address,
        from: args.from,
        to: args.to,
        amountRaw: args.value.toString(),
      });
    }

    // Stable order, so re-running over the same range yields the same array and
    // a test comparing two runs is not asserting on RPC arrival order.
    transfers.sort((a, b) =>
      a.blockNumber === b.blockNumber
        ? a.logIndex - b.logIndex
        : Number(a.blockNumber - b.blockNumber),
    );
    return transfers;
  }

  /**
   * A public contract read. Used for reference data such as a price feed.
   *
   * This does not sign and cannot: the adapter holds RPC endpoints, not a
   * key. A failure is the caller's to handle — this method does not turn an
   * unreachable node into a zero.
   *
   * A contract revert is that failure, and it is thrown as `RpcReverted`
   * before the pool can treat the node as dead. The node answered. Retrying
   * the same call on the next URL would only revert again.
   */
  async readContract(parameters: {
    address: `0x${string}`;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
  }): Promise<unknown> {
    return this.read(async (client) => {
      try {
        return await client.readContract({
          address: parameters.address,
          abi: parameters.abi as never,
          functionName: parameters.functionName as never,
          args: parameters.args as never,
        });
      } catch (err) {
        if (isContractRevert(err)) throw new RpcReverted();
        throw err;
      }
    });
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
