/**
 * Backing disclosure, rendered verbatim.
 *
 * The API returns the disclosure sentence alongside each asset; the screen
 * renders it as received. It never recomputes it — a second implementation
 * would drift, and drift on a backing claim fails in the direction that
 * is easiest to get wrong.
 */

/**
 * Whole metal from a raw balance, exactly. Bigint throughout: the backend
 * removed float math from this path for the same reason (balances past
 * 2^53 lose dust), so the display does not reintroduce it.
 *
 * `perTokenScaled` is grams (or ounces) per token scaled by 10^4, so
 * 31.1035 g/token arrives as 311035. The result carries four fixed
 * decimals, computed without a float anywhere.
 */
export function metalAmountParts(
  balanceRaw: string,
  decimals: number,
  gramsPerTokenScaled: number | null,
  ouncesPerToken?: number | null,
): string {
  const perToken = gramsPerTokenScaled ?? ouncesPerToken ?? null;
  if (perToken == null) return "Amount unavailable";
  const unit = gramsPerTokenScaled != null ? "g" : "oz";
  // raw * perToken / (10^decimals * 10^4), all in bigint, rendered at
  // four fixed decimals.
  const scaled = BigInt(balanceRaw) * BigInt(Math.round(perToken));
  const denom = 10n ** BigInt(decimals);
  const whole = scaled / (denom * 10_000n);
  const frac = (scaled % (denom * 10_000n)) / denom;
  return `${whole}.${frac.toString().padStart(4, "0")} ${unit}`;
}

export function holdingDisplay(holding: { unpriced: boolean; valueUsd: string | null }): string {
  // An unpriced holding renders as unpriced, never as $0 — $0 is a price,
  // and this holding has none.
  if (holding.unpriced || holding.valueUsd == null) return "Unpriced";
  return `$${holding.valueUsd}`;
}

export function Disclosure({ text }: { text: string }) {
  return <p className="text-sm text-muted">{text}</p>;
}
