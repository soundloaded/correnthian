import { describe, expect, it } from 'vitest';
import { refusalCopy, swapRefusal } from './buy-swap';

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
