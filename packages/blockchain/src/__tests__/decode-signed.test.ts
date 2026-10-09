import { describe, expect, it } from 'vitest';
import { parseTransaction, serializeTransaction } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { EvmAdapter } from '../evm.js';
import type { ChainDescriptor } from '../adapter.js';

/**
 * `decodeSignedTransaction` — BE-602's verification seam.
 *
 * The API relays a payload it did not see being signed. "The server
 * assembles, the device signs" is only enforceable if the server can then
 * read back *what was signed* and compare it against what it assembled —
 * otherwise the endpoint is "submit any bytes and we will file them as if
 * they matched the intent", and the ledger's destination column becomes
 * decoration.
 *
 * Recovery is the check: a payload whose fields were altered after signing
 * recovers a different address, because the signature covers the fields.
 * This method does not verify against an expected signer — it reports who
 * signed, and the service decides what that means. Observing and deciding
 * are separate, the same way `getTokenTransfers` observes and the indexer
 * decides.
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

const ACCOUNT = privateKeyToAccount(`0x${'11'.repeat(32)}` as `0x${string}`);
const BOB = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

const signed = (over: { value?: bigint; to?: `0x${string}`; chainId?: number } = {}) =>
  ACCOUNT.signTransaction({
    to: over.to ?? BOB,
    value: over.value ?? 1_000_000n,
    nonce: 7,
    chainId: over.chainId ?? 1,
    gas: 21_000n,
    maxFeePerGas: 1_000_000_008n,
    maxPriorityFeePerGas: 1_000_000_000n,
    type: 'eip1559',
  });

const adapter = () => new EvmAdapter(descriptor, [{ url: 'http://rpc.test' }]);

describe('decodeSignedTransaction', () => {
  it('reports who signed, and what they signed', async () => {
    const facts = await adapter().decodeSignedTransaction(await signed());

    expect(facts.chainId).toBe(1);
    expect(facts.from).toBe(ACCOUNT.address);
    expect(facts.to?.toLowerCase()).toBe(BOB);
    expect(facts.value).toBe('1000000');
    expect(facts.nonce).toBe(7);
  });

  it('recovers a different signer when the fields were altered after signing', async () => {
    // Tampering keeps the signature and edits the fields under it — signing
    // a different payload properly would simply produce a new valid one, and
    // the signer would still be right. The signature covers `value`, so an
    // edit moves recovery to an unrelated address, and the service will
    // refuse a payload whose recovered signer is not the account owner's.
    const original = await signed();
    const parsed = parseTransaction(original as `0x${string}`);
    const tampered = serializeTransaction({
      ...parsed,
      value: 999_999_999_999n,
    } as Parameters<typeof serializeTransaction>[0]);

    const facts = await adapter().decodeSignedTransaction(tampered);
    expect(facts.value).toBe('999999999999');
    expect(facts.from).not.toBe(ACCOUNT.address);
    // The honest one still recovers its own signer — the check distinguishes.
    expect((await adapter().decodeSignedTransaction(original)).from).toBe(ACCOUNT.address);
  });

  it('reports the chain id a payload was signed for', async () => {
    const facts = await adapter().decodeSignedTransaction(await signed({ chainId: 8453 }));
    expect(facts.chainId).toBe(8453);
  });

  it('rejects bytes that are not a transaction at all', async () => {
    await expect(adapter().decodeSignedTransaction('0xdeadbeef')).rejects.toThrow();
    await expect(adapter().decodeSignedTransaction('not hex')).rejects.toThrow();
  });
});
