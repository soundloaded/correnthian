import { describe, expect, it } from 'vitest';
import { explorerTxUrl, formatTokenAmount, shortenAddress } from './activity-helpers';

describe('activity helpers', () => {
  it('formats an exact whole-token amount, never a float', () => {
    expect(formatTokenAmount('1000000000000000000', 18)).toBe('1');
  });

  it('formats dust exactly, without losing low digits', () => {
    expect(formatTokenAmount('1', 18)).toBe('0.000000000000000001');
  });

  it('renders a decimal-string intent as stored, never reformatted', () => {
    // A user-filed intent may carry a decimal string the API accepted;
    // placing it exactly needs a form we do not infer, so it renders as stored.
    expect(formatTokenAmount('1.5', 18)).toBe('1.5');
  });

  it('renders amountRaw as stored when decimals are unknown', () => {
    // The row carries no decimals; when the asset join misses, the raw
    // value renders verbatim — exactly what the operator console shows.
    expect(formatTokenAmount('1000000000000000000', null)).toBe('1000000000000000000');
  });

  it('shortens a long address at both ends', () => {
    expect(shortenAddress('0xAbCdEf1234567890abcdef1234567890ABCDEF12')).toBe('0xAbCd…EF12');
  });

  it('leaves a short address alone', () => {
    expect(shortenAddress('bc1qw508d')).toBe('bc1qw508d');
  });

  it('builds an explorer transaction link for an EVM chain', () => {
    expect(explorerTxUrl({ family: 'evm', explorerUrl: 'https://etherscan.io' }, '0xabc')).toBe(
      'https://etherscan.io/tx/0xabc',
    );
  });

  it('builds no link without a hash, an explorer, or a known family', () => {
    expect(explorerTxUrl({ family: 'evm', explorerUrl: 'https://etherscan.io' }, null)).toBeNull();
    expect(explorerTxUrl({ family: 'evm', explorerUrl: null }, '0xabc')).toBeNull();
    expect(explorerTxUrl({ family: 'solana', explorerUrl: 'https://solscan.io' }, 'abc')).toBeNull();
    expect(explorerTxUrl({ family: 'evm', explorerUrl: 'http://etherscan.io' }, '0xabc')).toBeNull();
  });

  it('strips a trailing slash from the explorer base', () => {
    expect(explorerTxUrl({ family: 'evm', explorerUrl: 'https://basescan.org/' }, '0xabc')).toBe(
      'https://basescan.org/tx/0xabc',
    );
  });
});
