import { describe, expect, it } from 'vitest';
import { holdingDisplay, metalAmountParts } from './disclosure';

describe('holding display', () => {
  it('shows grams from gramsPerToken, exactly, never a float', () => {
    // 1 token at 18 decimals, 31.1035 g per token: exact bigint math.
    expect(metalAmountParts('1000000000000000000', 18, 311035, 4)).toBe('31.1035 g');
  });

  it('shows ounces when grams are absent', () => {
    // 1 oz/token arrives scaled as 10000 (1.0000 fixed point).
    expect(metalAmountParts('1000000000000000000', 18, null, 10000)).toBe('1.0000 oz');
  });

  it('says unpriced rather than showing $0 as a price', () => {
    expect(holdingDisplay({ unpriced: true, valueUsd: null })).toBe('Unpriced');
  });
});
