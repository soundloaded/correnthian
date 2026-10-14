/**
 * Formatting helpers.
 *
 * Monospace everywhere an operator may need to compare characters or copy a
 * value: hashes, addresses, amounts, timestamps.
 */
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const plain = new Intl.NumberFormat('en-US');

export const fmtCount = (n: number): string => plain.format(n);
export const fmtCompact = (n: number): string => compact.format(n);

export function fmtUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 2,
  }).format(value);
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toISOString().replace('T', ' ').slice(0, 19);
}

/** 0xAbCd…1234 — enough to recognise, short enough for a table cell. */
export function shortAddress(value: string | null | undefined): string {
  if (!value) return '—';
  return value.length <= 12 ? value : `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
