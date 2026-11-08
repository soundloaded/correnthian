import { describe, expect, it } from 'vitest';
import {
  buildQuoteBody,
  formatBaseUnits,
  isPositiveDecimalString,
  refusalCopy,
  swapRefusal,
  toBaseUnits,
} from './buy-swap';

describe('buy refusal states', () => {
  it('renders the API refusal verbatim, never a number', () => {
    expect(refusalCopy({ available: false, reason: 'No on-ramp provider is contracted yet.' })).toBe(
      'No on-ramp provider is contracted yet.',
    );
  });

  it('a none-quality quote renders no buy button', () => {
    expect(swapRefusal({ state: 'quoted', executionQuality: 'none' })).toBe(true);
  });

  it('an expired quote is history, not an offer', () => {
    // A deep-quality row the engine can fill is still not actionable
    // once it has expired — acting on it would sign a dead price.
    expect(swapRefusal({ state: 'expired', executionQuality: 'deep' })).toBe(true);
    expect(swapRefusal({ state: 'quoted', executionQuality: 'deep' })).toBe(false);
  });
});

describe('swap request form helpers', () => {
  it('accepts only positive plain decimals — never signs, words, or zero', () => {
    expect(isPositiveDecimalString('10.5')).toBe(true);
    expect(isPositiveDecimalString('1000000')).toBe(true);
    expect(isPositiveDecimalString('0')).toBe(false);
    expect(isPositiveDecimalString('0.00')).toBe(false);
    expect(isPositiveDecimalString('-5')).toBe(false);
    expect(isPositiveDecimalString('1e6')).toBe(false);
    expect(isPositiveDecimalString('abc')).toBe(false);
    expect(isPositiveDecimalString('')).toBe(false);
    expect(isPositiveDecimalString('1,000')).toBe(false);
  });

  it('converts display amounts to base units exactly, without a float', () => {
    // 6-decimal stablecoin: float math turns 10.5 * 1e6 into 10500000.000000002.
    expect(toBaseUnits('10.5', 6)).toBe('10500000');
    expect(toBaseUnits('1', 18)).toBe('1000000000000000000');
    expect(toBaseUnits('0.000001', 6)).toBe('1');
  });

  it('refuses amounts more precise than the asset rather than truncating', () => {
    // A 6-decimal stablecoin cannot express the 7th digit; truncating would
    // silently shrink the order below what the holder typed.
    expect(toBaseUnits('0.0000001', 6)).toBeNull();
    expect(toBaseUnits('abc', 6)).toBeNull();
  });

  it('renders minimum-received figures without trailing zeros', () => {
    expect(formatBaseUnits('1500000', 6)).toBe('1.5');
    expect(formatBaseUnits('1000000000000000000', 18)).toBe('1');
    expect(formatBaseUnits('0', 6)).toBe('0');
  });

  const base = { fromAssetId: 'from', toAssetId: 'to', amount: '10.5', fromDecimals: 6, slippageBps: 50 };

  it('builds the engine body from display values', () => {
    expect(buildQuoteBody(base)).toEqual({
      ok: true,
      body: { fromAssetId: 'from', toAssetId: 'to', fromAmountRaw: '10500000', slippageBps: 50 },
    });
  });

  it('blocks same-asset conversion — the engine rejects it as 400', () => {
    const out = buildQuoteBody({ ...base, toAssetId: 'from' });
    expect(out.ok).toBe(false);
  });

  it('blocks zero amounts and out-of-range slippage', () => {
    expect(buildQuoteBody({ ...base, amount: '0' }).ok).toBe(false);
    expect(buildQuoteBody({ ...base, amount: 'abc' }).ok).toBe(false);
    expect(buildQuoteBody({ ...base, slippageBps: 0 }).ok).toBe(false);
    expect(buildQuoteBody({ ...base, slippageBps: 5001 }).ok).toBe(false);
  });
});
