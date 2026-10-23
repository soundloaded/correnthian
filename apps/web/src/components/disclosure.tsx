/**
 * Backing disclosure, rendered verbatim.
 *
 * The API returns the disclosure sentence alongside each asset; the screen
 * renders it as received. It never recomputes it — a second implementation
 * would drift, and drift on a backing claim fails in the direction that
 * is easiest to get wrong.
 */

/** Whole grams from a raw balance and gramsPerToken. Token counts are never metal. */
export function formatMetalAmount(
  balanceRaw: string,
  decimals: number,
  gramsPerToken: number | null,
  ouncesPerToken?: number | null,
): string {
  if (gramsPerToken != null) {
    const tokens = Number(balanceRaw) / 10 ** decimals;
    const grams = tokens * gramsPerToken;
    return `${grams.toFixed(4)} g`;
  }
  if (ouncesPerToken != null) {
    const tokens = Number(balanceRaw) / 10 ** decimals;
    return `${(tokens * ouncesPerToken).toFixed(4)} oz`;
  }
  return "Amount unavailable";
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
