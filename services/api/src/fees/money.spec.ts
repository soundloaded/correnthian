import { describe, expect, it } from 'vitest';
import {
  applyBps, formatUsd, isWithinStoreRange, MoneyError, notionalUsd, parseUsd, scaleUsd, sumUsd,
  USD_SCALE, ZERO_USD,
} from './money.js';

describe('money — exact USD arithmetic', () => {
  describe('parseUsd', () => {
    it('parses a plain amount at full scale', () => {
      expect(parseUsd('1.5')).toBe(150_000_000n);
      expect(parseUsd('1234.56')).toBe(123_456_000_000n);
      expect(parseUsd('0')).toBe(0n);
      expect(parseUsd('42')).toBe(4_200_000_000n);
    });

    it('keeps precision a float would lose', () => {
      // 0.1 + 0.2 === 0.30000000000000004 in binary floating point. The whole
      // point of this module is that such a value cannot exist in it.
      const sum = sumUsd([parseUsd('0.1'), parseUsd('0.2')]);
      expect(formatUsd(sum)).toBe('0.30000000');
    });

    it('rounds input finer than the storage scale half-up, and not by accident', () => {
      // 9 decimal places: the 9th is the half-way digit.
      expect(formatUsd(parseUsd('1.000000005'))).toBe('1.00000001');
      expect(formatUsd(parseUsd('1.000000004'))).toBe('1.00000000');
      // And a long tail rounds on the first dropped digit, not the last.
      expect(formatUsd(parseUsd('1.0000000049999'))).toBe('1.00000000');
      expect(formatUsd(parseUsd('1.0000000050001'))).toBe('1.00000001');
    });

    it('is exact at the largest amount the column can hold', () => {
      // Decimal(36, 8): 28 digits before the point.
      const max = '9999999999999999999999999999.99999999';
      expect(isWithinStoreRange(parseUsd(max))).toBe(true);
    });

    it('refuses a negative, so no arithmetic can produce a rebate', () => {
      expect(() => parseUsd('-1')).toThrow(MoneyError);
      expect(() => parseUsd('-0.01')).toThrow(/negative/);
    });

    it('refuses anything that is not a plain decimal', () => {
      for (const bad of ['', ' ', 'abc', '1e3', '0x10', '1,000', '.5', 'Infinity', 'NaN', '+1']) {
        expect(() => parseUsd(bad), `"${bad}" should be refused`).toThrow(MoneyError);
      }
    });

    it('accepts a trailing point, which the wire regex is stricter about', () => {
      // `parseUsd` is deliberately the more permissive of the two: the request
      // DTO rejects `1.` before it reaches here, and a parser that refused
      // more than its caller does would turn a valid internal amount into a
      // 500. The direction of that gap is the safe one.
      expect(formatUsd(parseUsd('1.'))).toBe('1.00000000');
    });
  });

  describe('formatUsd', () => {
    it('always renders the full scale, so a real zero is legible as one', () => {
      expect(formatUsd(ZERO_USD)).toBe('0.00000000');
      expect(formatUsd(parseUsd('0'))).toBe('0.00000000');
      expect(formatUsd(parseUsd('7'))).toBe('7.00000000');
    });

    it('round-trips every value it can hold, exactly', () => {
      for (const v of ['0.00000000', '0.00000001', '9.99000000', '123456789.12345678']) {
        expect(formatUsd(parseUsd(v)), `round-trip of ${v}`).toBe(v);
      }
    });
  });

  describe('applyBps', () => {
    it('computes a percentage exactly where a float would not', () => {
      // 1.49% of 1,234.56. In floats this is 18.394944000000002.
      expect(formatUsd(applyBps(parseUsd('1234.56'), 149))).toBe('18.39494400');
    });

    it('rounds half-up at the last stored digit', () => {
      // 1 bp of 0.00005 USD is 0.000000005 — exactly half, so it goes up.
      expect(formatUsd(applyBps(parseUsd('0.00005'), 1))).toBe('0.00000001');
      // And a hair under stays down.
      expect(formatUsd(applyBps(parseUsd('0.00004'), 1))).toBe('0.00000000');
    });

    it('is a real zero when the rate is zero, not a rounding artefact', () => {
      expect(formatUsd(applyBps(parseUsd('1234.56'), 0))).toBe('0.00000000');
    });

    it('does not drift when applied across many quotes', () => {
      // A tenth of a basis point times a hundred thousand quotes: exact in
      // integers, a growing error in floats.
      const perQuote = applyBps(parseUsd('1000'), 1);
      expect(formatUsd(perQuote)).toBe('0.10000000');
      expect(formatUsd(scaleUsd(perQuote, 100_000n))).toBe('10000.00000000');
    });

    it('refuses a fractional rate', () => {
      expect(() => applyBps(parseUsd('100'), 1.5)).toThrow(/integer/);
    });

    it('agrees with exact arithmetic at a magnitude where a float visibly does not', () => {
      // One basis point of 9,999,999,999,999,999.99 is 999,999,999,999.999999.
      // The float path cannot represent the input, rounds it to 1e16, and
      // returns a whole 1,000,000,000,000 — a micro-dollar apart, and a
      // disagreement between a quote and an invoice.
      const notional = parseUsd('9999999999999999.99');
      expect(formatUsd(applyBps(notional, 1))).toBe('999999999999.99999900');
      expect((9999999999999999.99 * 0.0001).toFixed(8)).toBe('1000000000000.00000000');
    });

    it('refuses a negative rate', () => {
      expect(() => applyBps(parseUsd('100'), -1)).toThrow(/negative/);
    });
  });

  describe('notionalUsd', () => {
    it('prices a raw token amount exactly, at the token’s own decimals', () => {
      // 1.5 token at 18 decimals, priced at $2,000.00.
      const price = parseUsd('2000');
      expect(formatUsd(notionalUsd('1500000000000000000', 18, price))).toBe('3000.00000000');
      // Six decimals, the usual stablecoin shape.
      expect(formatUsd(notionalUsd('2500000', 6, parseUsd('1')))).toBe('2.50000000');
    });

    it('does not lose the low digits of an 18-decimal balance', () => {
      // `Number('1000000000000000001')` is 1e18 exactly — the final unit is
      // gone before any arithmetic happens. This asserts the integer path
      // keeps it, and that the float path, run for comparison, does not.
      const raw = '1000000000000000001';
      expect(formatUsd(notionalUsd(raw, 18, parseUsd('1')))).toBe('1.00000000');
      expect(Number(raw)).toBe(1e18);
    });

    it('rounds half-up at the last stored digit', () => {
      // Half a token at 18 decimals, priced at one 10^-8 USD: the product is
      // exactly half of one stored unit, so it goes up.
      const price = parseUsd('0.00000001');
      expect(formatUsd(notionalUsd('500000000000000000', 18, price))).toBe('0.00000001');
      // And a hair under stays down.
      expect(formatUsd(notionalUsd('400000000000000000', 18, price))).toBe('0.00000000');
    });

    it('is exact where a float multiply visibly is not', () => {
      // 0.7 of a token priced at $0.10. The exact answer is 0.07; the float
      // path evaluates to 0.06999999999999999, and a fee computed from that
      // is a different number from the one an invoice will show.
      const raw = '700000000000000000';
      expect(formatUsd(notionalUsd(raw, 18, parseUsd('0.1')))).toBe('0.07000000');
      expect((Number(raw) / 10 ** 18) * 0.1).not.toBe(0.07);
    });

    it('agrees with exact arithmetic where the float error reaches the stored digit', () => {
      // Three units of a token priced at $9,999,999,999.99999999. The float
      // path cannot represent the price, rounds it, and returns exactly
      // $30,000,000,000 — three cents away from the answer, at a size where
      // three cents is not a rounding difference anyone would notice going
      // the wrong way.
      expect(formatUsd(notionalUsd('3', 0, parseUsd('9999999999.99999999')))).toBe('29999999999.99999997');
      expect((3 * 9999999999.99999999).toFixed(8)).toBe('30000000000.00000000');
    });

    it('refuses a base-unit count that is not a plain integer', () => {
      for (const bad of ['', '1.5', '-1', '1e18', 'abc']) {
        expect(() => notionalUsd(bad, 18, parseUsd('1')), `"${bad}" should be refused`).toThrow(MoneyError);
      }
    });

    it('refuses a nonsensical decimals count rather than guessing', () => {
      expect(() => notionalUsd('1', -1, parseUsd('1'))).toThrow(MoneyError);
      expect(() => notionalUsd('1', 1.5, parseUsd('1'))).toThrow(MoneyError);
    });
  });

  describe('sumUsd', () => {
    it('adds without rounding any part', () => {
      // The third input has a 9th digit of `3`, so it rounds *down* on the way
      // in to `0.33333333`. The sum introduces no further error of its own —
      // which is the property under test, not the rounding of the input.
      const parts = ['0.1', '0.2', '0.333333333'].map(parseUsd);
      expect(formatUsd(sumUsd(parts))).toBe('0.63333333');

      // Ten additions of 0.1. The exact answer is 1; the float answer is
      // 0.9999999999999999. This is the drift the module exists to remove.
      const tenths = Array.from({ length: 10 }, () => parseUsd('0.1'));
      expect(formatUsd(sumUsd(tenths))).toBe('1.00000000');
      expect(Array.from({ length: 10 }).reduce<number>((s) => s + 0.1, 0)).not.toBe(1);
    });

    it('is zero for an empty list, which is a complete total of nothing', () => {
      expect(formatUsd(sumUsd([]))).toBe('0.00000000');
    });
  });
});
