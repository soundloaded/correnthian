import { describe, expect, it } from 'vitest';
import { redact } from '../index.js';

/**
 * `redact` covers key material — seeds, hex keys, addresses — and has always
 * stopped there. An RPC endpoint is not key material, but it is the other
 * thing this repository refuses to hand out: `BlockchainService` never
 * returns RPC URLs because they are a metered quota, and a provider error
 * string arrives wearing one (`URL: http://rpc…` is standard viem output).
 * A failure path that "records the failure and not the internals" while
 * passing a URL through untouched is a redactor that lost the argument it
 * was built for.
 */
describe('redact — endpoints', () => {
  it('removes an http URL wherever it appears', () => {
    const message =
      'HTTP request failed. URL: http://rpc.internal:8545/v1/abc123?token=zz Status: 500';
    const out = redact(message);
    expect(out).not.toContain('rpc.internal');
    expect(out).not.toContain('http://');
    expect(out).toContain('[REDACTED:URL]');
    // The fact of the failure survives; only the location is gone.
    expect(out).toContain('HTTP request failed');
    expect(out).toContain('Status: 500');
  });

  it('removes an https URL in a list', () => {
    const out = redact('failed talking to https://evm.example.io/rpc and localhost:8545');
    expect(out).not.toContain('evm.example.io');
  });

  it('leaves ordinary prose alone', () => {
    expect(redact('chain 1 is not enabled')).toBe('chain 1 is not enabled');
  });
});
