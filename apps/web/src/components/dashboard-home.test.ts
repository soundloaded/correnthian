import { describe, expect, it } from 'vitest';
import { formatUsdDisplay, sharePct } from './dashboard-home';

describe('dashboard display figures', () => {
  it('renders 10^-8 USD strings at two decimals without a float', () => {
    // A dust balance must not round into a cent it does not own.
    expect(formatUsdDisplay('148250.75000000')).toBe('$148,250.75');
    expect(formatUsdDisplay('0.00499999')).toBe('$0.00');
    expect(formatUsdDisplay('0.00000000')).toBe('$0.00');
  });

  it('renders integer basis-point shares without trailing .0', () => {
    expect(sharePct(5680)).toBe('56.8%');
    expect(sharePct(5000)).toBe('50%');
  });
});
