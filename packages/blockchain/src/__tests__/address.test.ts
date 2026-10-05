import { describe, expect, it } from 'vitest';
import { validateAddress, validateEvmAddress, formatAddress } from '../address.js';

describe('EVM address validation', () => {
  const lower = '0xdac17f958d2ee523a2206206994597c13d831ec7';

  it('accepts a well-formed lowercase address', () => {
    expect(validateEvmAddress(lower).valid).toBe(true);
  });

  it('normalises to lowercase for storage', () => {
    expect(validateEvmAddress(lower.toUpperCase().replace('0X', '0x')).normalised).toBe(lower);
  });

  it('rejects the wrong length', () => {
    expect(validateEvmAddress('0x1234').valid).toBe(false);
  });

  it('rejects a missing 0x prefix', () => {
    expect(validateEvmAddress(lower.slice(2)).valid).toBe(false);
  });

  it('rejects non-hex characters', () => {
    expect(validateEvmAddress('0xzzc17f958d2ee523a2206206994597c13d831ec7').valid).toBe(false);
  });

  it('refuses a mixed-case address it cannot verify rather than trusting it', () => {
    // Claims an EIP-55 checksum. We cannot check it, so trusting it would be
    // exactly the assumption that loses funds on a transposition typo.
    const mixed = `0xDAC17F958D2eE523A2206206994597C13D831ec7`;
    const result = validateEvmAddress(mixed);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/EIP-55/);
  });
});

describe('address dispatch', () => {
  it('rejects an empty address', () => {
    expect(validateAddress('   ', 'evm').valid).toBe(false);
  });

  it('rejects a Bitcoin address submitted as EVM', () => {
    expect(validateAddress('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', 'evm').valid).toBe(false);
  });

  it('accepts a bech32 Bitcoin address', () => {
    expect(validateAddress('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', 'bitcoin').valid).toBe(true);
  });

  it('rejects an unsupported family instead of passing it through', () => {
    expect(validateAddress('anything', 'dogecoin' as never).valid).toBe(false);
  });
});

describe('formatAddress', () => {
  it('shortens for display without changing meaning', () => {
    expect(formatAddress('0xdac17f958d2ee523a2206206994597c13d831ec7')).toBe('0xdac1…1ec7');
  });

  it('leaves a short string intact', () => {
    expect(formatAddress('0x1234')).toBe('0x1234');
  });
});
