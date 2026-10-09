import { describe, expect, it } from 'vitest';
import { decodeFunctionData, erc20Abi } from 'viem';
import { EvmAdapter } from '../evm.js';
import type { ChainDescriptor } from '../adapter.js';

/**
 * `assemblePayload` — the pure half of assembly.
 *
 * `buildTransaction` needs a node: gas, nonce and fees are answers, not
 * inputs. But the *intent* half — where the value goes, and what calldata it
 * carries — is deterministic from the request alone, and the relay path needs
 * it without asking the chain anything: the server re-derives what the
 * payload must say and compares that against what the device signed. Doing
 * that through `buildTransaction` would cost an `eth_estimateGas` per
 * broadcast and could fail for reasons unrelated to the comparison.
 *
 * So the shape is split: this computes, that computes *and* asks. The wire
 * test for `buildTransaction` is what pins the two agreeing.
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

const BOB = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const TOKEN = '0xcccccccccccccccccccccccccccccccccccccccc';

const adapter = () => new EvmAdapter(descriptor, [{ url: 'http://rpc.test' }]);

describe('assemblePayload', () => {
  it('describes a native transfer as value to the destination', () => {
    expect(
      adapter().assemblePayload({ chainId: '1', to: BOB, value: '1000000' }),
    ).toEqual({ to: BOB, value: '1000000', data: '0x' });
  });

  it('describes a token transfer as zero value against the contract, with the amount encoded', () => {
    const payload = adapter().assemblePayload({
      chainId: '1', to: BOB, token: TOKEN, amount: '1000000',
    });

    expect(payload.to).toBe(TOKEN);
    expect(payload.value).toBe('0');
    const decoded = decodeFunctionData({ abi: erc20Abi, data: payload.data as `0x${string}` });
    expect(decoded.functionName).toBe('transfer');
    expect(String(decoded.args?.[0]).toLowerCase()).toBe(BOB);
    expect(decoded.args?.[1]).toBe(1_000_000n);
  });

  it('refuses the same malformed inputs buildTransaction refuses', () => {
    expect(() => adapter().assemblePayload({
      chainId: '1', to: BOB, token: TOKEN, amount: '1.5',
    })).toThrow(/positive integer/);
    expect(() => adapter().assemblePayload({
      chainId: '1', to: BOB, token: TOKEN, amount: '5', data: '0xdead',
    })).toThrow(/combined with explicit data/);
  });
});
