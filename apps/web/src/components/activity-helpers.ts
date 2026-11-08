/**
 * Activity row display helpers — pure formatting, no data fetching.
 *
 * Amounts are exact bigint math throughout: the row carries no decimals, so
 * the asset join supplies them and a row with no match renders its raw value
 * verbatim — exactly what the operator console shows, never a guess.
 */
export function formatTokenAmount(amountRaw: string, decimals: number | null): string {
  // The row mixes two writers: chain-observed rows are base-unit integers,
  // user-filed intents may be decimal strings the API accepted. Only a
  // digit-only string can be placed exactly, so anything else renders stored.
  if (decimals == null || !/^\d+$/.test(amountRaw)) return amountRaw;
  const denom = 10n ** BigInt(decimals);
  const raw = BigInt(amountRaw);
  const whole = raw / denom;
  const frac = (raw % denom).toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac === "" ? whole.toString() : `${whole}.${frac}`;
}

/** Display form: 0xAbCd…EF12. Never use this in a transaction. */
export function shortenAddress(address: string): string {
  if (address.length <= 11) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * Explorer transaction link, or null when there is nothing to link to.
 *
 * shortcut: EVM `/tx/` path shape only — extend per family when a chain of
 * that family is enabled. Only https bases link; anything else renders as text.
 */
export function explorerTxUrl(
  chain: { family: string; explorerUrl: string | null },
  txHash: string | null,
): string | null {
  if (!txHash || chain.explorerUrl == null || chain.family !== "evm") return null;
  if (!chain.explorerUrl.startsWith("https://")) return null;
  return `${chain.explorerUrl.replace(/\/+$/, "")}/tx/${txHash}`;
}
