import { describe, expect, it } from 'vitest';
import { formatMetalAmount, holdingDisplay } from './disclosure';

describe('holding display', () => {
  it('shows grams from gramsPerToken, never a token count as metal', () => {
    expect(formatMetalAmount('1000000000000000000', 18, 31.1035)).toBe('31.1035 g');
  });

  it('shows ounces when grams are absent', () => {
    expect(formatMetalAmount('1000000000000000000', 18, null, 1)).toBe('1.0000 oz');
  });

  it('says unpriced rather than showing $0 as a price', () => {
    expect(holdingDisplay({ unpriced: true, valueUsd: null })).toBe('Unpriced');
  });
});
