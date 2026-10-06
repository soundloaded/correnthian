/**
 * Exact USD arithmetic for fees.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS NOT A NUMBER
 *
 * `number` is a binary float. It cannot represent 0.1, and it cannot represent
 * most percentages of most notionals. A fee of 1.49% on $1,234.56 computed in
 * floats is wrong in the last place or two, and — more damaging than the size
 * of the error — *which way* it is wrong depends on the input. A fee engine
 * that rounds down on Tuesday and up on Wednesday is not something finance can
 * reconcile, and a quote that disagrees with the invoice by a cent is a
 * support ticket per trade.
 *
 * So: nothing here ever touches a float. Every value is an integer count of
 * 10^-8 USD, held in a `bigint`, and every operation is integer arithmetic
 * with one explicit, documented rounding rule.
 *
 * ---------------------------------------------------------------------------
 * WHY 10^-8
 *
 * It is the scale of `SwapQuote.notionalUsd` (`Decimal(36, 8)` in the
 * database). Fees and the notional they are computed from should share a
 * scale, or a total and its parts would round against each other and stop
 * adding up.
 *
 * ---------------------------------------------------------------------------
 * THE ROUNDING RULE, STATED ONCE
 *
 * Half-up, away from zero, at 10^-8 USD, applied at exactly two places:
 * parsing an input with more precision than we store, and applying a rate.
 * Intermediate results are never rounded, so a fee is not a rounded sum of
 * rounded steps.
 *
 * Rounding at the 8th decimal of a dollar is a decision, not an accident:
 * 10^-8 USD is a hundred-thousandth of a cent. It is far below any amount
 * anyone charges, and it is far enough down that two different orders of
 * operation on the same inputs produce the same answer.
 *
 * ---------------------------------------------------------------------------
 * NO NEGATIVES
 *
 * A negative fee is a rebate. That is a coherent product feature and a
 * commercial decision, and it must not arrive by accident because a sign
 * slipped through a parser. `parseUsd` refuses a negative, so no amount of
 * arithmetic on fees can produce money flowing the wrong way.
 */

/** Decimal places stored, matching `SwapQuote.notionalUsd`. */
export const USD_SCALE = 8;

/** Basis points in one whole. A rate is an integer count of these. */
export const BPS_DENOMINATOR = 10_000n;

/**
 * An exact USD amount, as a count of 10^-8 USD.
 *
 * Branded so a bare `bigint` — which could be wei, or grams, or seconds —
 * cannot be passed where USD is meant.
 */
export type Usd = bigint & { readonly __usd: unique symbol };

const DECIMAL = /^(\d+)(?:\.(\d*))?$/;

/** Thrown for malformed money. Never crosses the HTTP boundary as a 500. */
export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

/**
 * Parse an exact decimal string into USD units.
 *
 * A string, not a number, because `parseFloat` on the way in would defeat
 * every guarantee below it. The API already validates money as a decimal
 * string (`fromAmountRaw`, `notionalUsd`); this keeps it a string all the way
 * down.
 *
 * Input finer than 10^-8 is rounded half-up rather than rejected. Rejecting it
 * would 400 a quote over a digit nobody can see, and the digit is a
 * hundred-thousandth of a cent.
 */
export function parseUsd(input: string): Usd {
  const trimmed = typeof input === 'string' ? input.trim() : '';
  if (trimmed.startsWith('-')) {
    // See the header. A rebate is a decision, not a parser's output.
    throw new MoneyError('A USD amount must not be negative');
  }
  const match = DECIMAL.exec(trimmed);
  if (!match) throw new MoneyError(`"${input}" is not a plain decimal USD amount`);

  const whole = match[1] as string;
  const rawFraction = match[2] ?? '';

  let roundUp = false;
  let fraction = rawFraction;
  if (fraction.length > USD_SCALE) {
    // Half-up on the first digit we are dropping.
    roundUp = fraction.charCodeAt(USD_SCALE) - 48 >= 5;
    fraction = fraction.slice(0, USD_SCALE);
  }

  const units = BigInt(whole + fraction.padEnd(USD_SCALE, '0'));
  return (roundUp ? units + 1n : units) as Usd;
}

/**
 * Render USD units as a fixed-precision decimal string.
 *
 * Fixed precision rather than trimmed: `"0.00000000"` says "this is zero and
 * we mean it", where `"0"` is indistinguishable from a placeholder. The whole
 * fee engine exists to tell those two apart.
 */
export function formatUsd(units: Usd): string {
  if (units < 0n) throw new MoneyError('A USD amount must not be negative');
  const digits = units.toString().padStart(USD_SCALE + 1, '0');
  return `${digits.slice(0, -USD_SCALE)}.${digits.slice(-USD_SCALE)}`;
}

/** The zero amount, spelled out where it is meant so it reads as deliberate. */
export const ZERO_USD = 0n as Usd;

export function isZeroUsd(units: Usd): boolean {
  return units === 0n;
}

/** Exact addition. No rounding — the values already share a scale. */
export function sumUsd(values: readonly Usd[]): Usd {
  let total = 0n;
  for (const v of values) total += v;
  return total as Usd;
}

/**
 * Apply an integer rate in basis points.
 *
 * `rateBps` is an integer so the rate itself is exact — 1.49% is `149`, not
 * `0.0149`. A fractional rate is the same class of bug as a fractional amount,
 * one level up, and it is the one that compounds across every quote.
 *
 * 1 bp is the finest rate this model can express. That is a deliberate floor:
 * a basis point is the unit fees are negotiated in, and a rate finer than one
 * is not a price anyone quotes. A fee that genuinely needs to be smaller is
 * better expressed as a fixed amount.
 *
 * Half-up, matching `parseUsd`. Inputs are non-negative, so this is the same
 * as "away from zero".
 */
export function applyBps(amount: Usd, rateBps: number): Usd {
  if (!Number.isInteger(rateBps)) {
    throw new MoneyError(`A rate must be an integer count of basis points, got ${rateBps}`);
  }
  if (rateBps < 0) throw new MoneyError('A rate must not be negative');
  const product = amount * BigInt(rateBps);
  return ((product + BPS_DENOMINATOR / 2n) / BPS_DENOMINATOR) as Usd;
}

/**
 * Multiply USD by an ordinary count — a number of items, a quantity.
 *
 * Kept separate from `applyBps` because the units differ and a caller that
 * confuses them is off by a factor of ten thousand.
 */
export function scaleUsd(amount: Usd, times: bigint): Usd {
  if (times < 0n) throw new MoneyError('A multiplier must not be negative');
  return (amount * times) as Usd;
}

/**
 * A USD notional from a raw token amount and a unit price in USD.
 *
 * The one place a token amount meets a price, and therefore the one place a
 * fee engine can be undercharged by accident. The formula is
 *
 *     notional = amountRaw / 10^decimals · priceUsd
 *
 * and the naive implementation — `Number(amountRaw) / 10 ** decimals *
 * priceUsd` — is three floats. On an 18-decimal balance that loses the low
 * digits of the amount and then multiplies the loss by a price, so the error
 * moves with the size of the trade. A fee computed from it is wrong by an
 * amount nobody can predict, and it is wrong in a direction that depends on
 * the input.
 *
 * Here it is one integer multiplication and one rounded division:
 *
 *     (amountRaw · priceUnits) / 10^decimals
 *
 * because `priceUnits` is already at 10^-8 USD and the result is wanted at
 * 10^-8 USD, so the price's scale cancels and only the token's decimals
 * remain. Half-up, matching `parseUsd` and `applyBps`.
 *
 * `amountRaw` is a string of base units — not a human amount, and never a
 * `number`, which cannot hold an 18-decimal balance to begin with.
 */
export function notionalUsd(amountRaw: string, decimals: number, priceUnits: Usd): Usd {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 77) {
    throw new MoneyError(`A token's decimals must be a small non-negative integer, got ${decimals}`);
  }
  if (!/^\d+$/.test(amountRaw)) {
    throw new MoneyError(`"${amountRaw}" is not a count of base units`);
  }
  if (priceUnits < 0n) throw new MoneyError('A price must not be negative');

  const scaled = BigInt(amountRaw) * priceUnits;
  const divisor = 10n ** BigInt(decimals);
  return ((scaled + divisor / 2n) / divisor) as Usd;
}

/**
 * The largest USD amount this scale can hold exactly.
 *
 * `Decimal(36, 8)` leaves 28 digits before the point. Stated so a bounds check
 * can cite a number rather than a shrug.
 */
export const MAX_USD_UNITS = 10n ** 36n - 1n;

export function isWithinStoreRange(units: Usd): boolean {
  return units <= MAX_USD_UNITS;
}
