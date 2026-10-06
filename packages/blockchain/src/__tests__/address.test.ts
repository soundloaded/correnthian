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

  // Canonical EIP-55 vectors. Verification is now real, so a checksummed
  // address is checked rather than refused — this is the check that catches a
  // transposed character.
  it('accepts a valid EIP-55 checksummed address', () => {
    expect(validateEvmAddress('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed').valid).toBe(true);
  });

  it('accepts the second canonical EIP-55 vector', () => {
    expect(validateEvmAddress('0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359').valid).toBe(true);
  });

  it('rejects a transposed address that keeps valid hex casing', () => {
    // One character moved. Without a checksum check this passes every other
    // test in this file and funds go to an address nobody controls.
    const valid = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
    const typo = valid.slice(0, 34) + '9' + valid.slice(35);
    const result = validateEvmAddress(typo);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/EIP-55|mistyped/);
  });

  it('rejects a mixed-case address with a broken checksum', () => {
    const result = validateEvmAddress('0xDAC17F958D2eE523A2206206994597C13D831ec7');
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/EIP-55|mistyped/);
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
