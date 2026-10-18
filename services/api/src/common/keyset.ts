import { AppError } from './errors.js';

/**
 * Cursor pagination that does not repeat or drop rows.
 *
 * The defect this exists to end (DEF-015): four lists paginated with
 * `cursor: { id }` plus `skip: 1` while ordering by a *timestamp*. The two
 * halves of the sort key were never both carried, so a row sharing a timestamp
 * with the cursor could land on either page — the list an operator reconciles
 * money against quietly showing a duplicate or a gap under concurrent writes.
 *
 * The shape follows `SwapsService`, which already did this correctly:
 *
 *   1. `orderBy` is the full key — `[timestamp desc, id desc]` — so the order
 *      is total and stable across ties.
 *   2. the cursor carries **both** halves, encoded and opaque.
 *   3. "after the cursor" is expressed as
 *      `at < cursor.at  OR  (at = cursor.at AND id < cursor.id)`.
 *   4. an unreadable cursor is a 400, never a silent restart at page one —
 *      a restart hides a client bug behind a page that looks correct.
 *
 * The wire format is `{ t, i }` base64url, unchanged from the two services
 * that already emitted it, so existing cursors keep working. It is opaque for a
 * reason: encoding a raw `createdAt` would invite clients to construct their
 * own.
 *
 * The filter is centralised rather than written out per list, which is the
 * point: the defect was two lists drifting away from a pattern two others had
 * already got right. The cost of centralising is that the timestamp field
 * travels as a `string`, so Prisma cannot check that name at compile time —
 * a typo there fails loudly at query time rather than silently, and it is one
 * name in one place with a test over it.
 */

export interface KeysetCursor {
  /**
   * The sort value of the last row of the previous page. A `Date` for
   * timestamp orders, the raw value otherwise — `decodeCursor` preserves
   * whatever the encoder wrote, and each consumer interprets it for its own
   * column. A timestamp-only type here is what made email cursors unreadable.
   */
  at: Date | string;
  id: string;
}

/** Both halves of the sort key. Either alone is ambiguous. */
export const KEYSET_ORDER = [{ createdAt: 'desc' }, { id: 'desc' }] as const;

/**
 * `at` is whichever timestamp the list sorts on — `createdAt` for most,
 * `lastSeenAt` for the admin device list. Named `at` rather than after one
 * particular column so the second caller does not have to pretend.
 */
export function encodeCursor(row: { id: string; at: Date | string }): string {
  const at = row.at instanceof Date ? row.at.toISOString() : row.at;
  return Buffer.from(JSON.stringify({ t: at, i: row.id }), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): KeysetCursor {
  let parsed: { t?: unknown; i?: unknown };
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      t?: unknown;
      i?: unknown;
    };
  } catch {
    throw AppError.badRequest('cursor is not a valid pagination cursor');
  }
  if (typeof parsed?.i !== 'string' || (typeof parsed?.t !== 'string' && !(parsed?.t instanceof String))) {
    // Silently restarting at page one would hide a client bug behind a page
    // that looks correct, so this is an error rather than a default.
    throw AppError.badRequest('cursor is not a valid pagination cursor');
  }
  const raw = String(parsed.t);
  // Timestamp orders keep Date semantics (comparison operators on the column);
  // anything else stays a string so a non-date sort value survives the
  // round trip instead of becoming Invalid Date at decode time.
  const asDate = new Date(raw);
  const at: Date | string = Number.isNaN(asDate.getTime()) ? raw : asDate;
  return { at, id: parsed.i };
}

/**
 * Rows strictly after `after`, ordered by `field dir, id dir`.
 *
 * Returns `{}` for the first page. The timestamp field is a parameter because
 * not every list sorts on `createdAt` — the admin's device list sorts on
 * `lastSeenAt`, which is what an operator actually looks for — but `id` is
 * always the tiebreak, because it is always unique. Direction matters to the
 * comparison: after the cursor on a descending page means strictly less,
 * on an ascending page strictly greater. The cursor stays `{ t, i }` either
 * way; `t` is the row's value for the sort column.
 */
export function keysetAfter(
  after: KeysetCursor | null,
  field: string,
  dir: 'asc' | 'desc' = 'desc',
): object {
  if (!after) return {};
  const cmp = dir === 'asc' ? 'gt' : 'lt';
  return {
    // Under `AND`, never as a bare `OR`: a caller's own `where` may already
    // carry one — `users.list` ORs across email and displayName when
    // searching — and a spread of `{ OR: [...] }` would silently replace it,
    // dropping the search filter entirely. Prisma applies a sibling `AND` and
    // `OR` conjunctively, so nesting is safe either way.
    AND: [
      {
        OR: [
          { [field]: { [cmp]: after.at } },
          { [field]: after.at, id: { [cmp]: after.id } },
        ],
      },
    ],
  };
}
