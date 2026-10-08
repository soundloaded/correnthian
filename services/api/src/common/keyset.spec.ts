import { describe, expect, it } from 'vitest';
import { AppError } from './errors.js';
import { decodeCursor, encodeCursor, KEYSET_ORDER, keysetAfter } from './keyset.js';

/**
 * The cursor is the whole contract between two pages.
 *
 * DEF-015 was a list paginating on half a sort key. These tests pin the other
 * half — that the encoded cursor carries both the timestamp and the id, that
 * "after the cursor" is the OR over both, and that a cursor nobody can read is
 * an error rather than a quiet restart at page one.
 */
describe('encode/decode', () => {
  const row = { id: 'usr_abc123', at: new Date('2026-10-08T11:22:33.000Z') };

  it('round-trips both halves of the sort key', () => {
    const back = decodeCursor(encodeCursor(row));
    expect(back.id).toBe(row.id);
    expect(back.at.getTime()).toBe(row.at.getTime());
  });

  it('writes the wire format the two existing services already emitted', () => {
    // `{ t, i }` base64url. Changing this silently invalidates cursors already
    // in a browser history and in any link an operator has pasted.
    const encoded = encodeCursor(row);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/); // base64url, no padding
    const json = Buffer.from(encoded, 'base64url').toString('utf8');
    expect(JSON.parse(json)).toEqual({
      t: '2026-10-08T11:22:33.000Z',
      i: 'usr_abc123',
    });
  });

  it('is not a raw id, so a client cannot construct one', () => {
    expect(encodeCursor(row)).not.toBe(row.id);
    expect(encodeCursor(row)).not.toContain('usr_abc123');
  });

  it.each([
    ['not base64url json', '!!!not-a-cursor!!!'],
    ['base64url of non-json', Buffer.from('hello').toString('base64url')],
    ['json with no id', Buffer.from(JSON.stringify({ t: '2026-10-08T00:00:00.000Z' })).toString('base64url')],
    ['json with a bad date', Buffer.from(JSON.stringify({ t: 'not-a-date', i: 'x' })).toString('base64url')],
    ['json with no date', Buffer.from(JSON.stringify({ i: 'x' })).toString('base64url')],
  ])('refuses %s with a 400 rather than restarting at page one', (_label, bad) => {
    // `decodeCursor` throws, so the assertion has to catch — the cast in a
    // first draft read the return type and let the exception escape.
    const err = caught(() => decodeCursor(bad)) as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(400);
    expect(err.message).toBe('cursor is not a valid pagination cursor');
  });
});

describe('keysetAfter', () => {
  const at = new Date('2026-10-08T11:22:33.000Z');

  it('returns an empty filter for the first page', () => {
    expect(keysetAfter(null, 'createdAt')).toEqual({});
  });

  it('matches strictly after the cursor, timestamp first', () => {
    expect(keysetAfter({ at, id: 'usr_abc123' }, 'createdAt')).toEqual({
      AND: [{ OR: [
        { createdAt: { lt: at } },
        { createdAt: at, id: { lt: 'usr_abc123' } },
      ] }],
    });
  });

  it('nests under AND so a caller\'s own OR survives the spread', () => {
    // `users.list` ORs across email and displayName when searching. A bare
    // `{ OR: [...] }` spread over that where would delete the search filter
    // silently — pagination would "work" and filtering would stop.
    const keyset = keysetAfter({ at, id: 'usr_abc123' }, 'createdAt') as Record<string, unknown>;
    const merged = {
      OR: [{ email: { contains: 'a' } }],
      ...keyset,
    };
    expect(merged.OR).toEqual([{ email: { contains: 'a' } }]); // search intact
    expect(merged).toHaveProperty('AND');
  });

  it('uses the field it is given, so a list sorting on another column works', () => {
    const filter = JSON.stringify(keysetAfter({ at, id: 'dev_1' }, 'lastSeenAt'));
    expect(filter).toContain('lastSeenAt');
    expect(filter).not.toContain('createdAt');
  });

  it('breaks ties on id, because a timestamp alone is not a position', () => {
    // This is the defect: two rows sharing `createdAt` are ordered by nothing,
    // so the page boundary between them can move. `id` is always unique.
    const keyset = keysetAfter({ at, id: 'usr_abc123' }, 'createdAt') as {
      AND: Array<{ OR: Array<Record<string, unknown>> }>;
    };
    expect(keyset.AND[0]?.OR[1]).toEqual({ createdAt: at, id: { lt: 'usr_abc123' } });
  });
});

describe('KEYSET_ORDER', () => {
  it('sorts on both halves, timestamp first', () => {
    expect([...KEYSET_ORDER]).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });

  it('is usable as a mutable array, which is what Prisma requires', () => {
    // `as const` makes the tuple readonly, and Prisma's orderBy takes a mutable
    // array — the spread at the call site is what makes it assignable.
    expect(Array.isArray([...KEYSET_ORDER])).toBe(true);
  });
});

/** Returns the thrown value, or null if nothing was thrown. */
function caught(fn: () => unknown): unknown {
  try {
    fn();
    return null;
  } catch (e) {
    return e;
  }
}
