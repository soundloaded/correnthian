import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../common/errors.js';
import { decodeCursor, encodeCursor } from '../common/keyset.js';
import type { ListUsersDto } from './dto/list-users.dto.js';
import { UsersService } from './users.service.js';

/**
 * DEF-015 — pagination that is not keyset.
 *
 * `list` ordered by `createdAt` but paginated with `cursor: { id }` and
 * `skip: 1`: it carried only half the sort key. Two accounts created in the
 * same instant are ordered by nothing, so the page boundary between them can
 * move — the list an operator reconciles money against showing a duplicate or
 * a gap under concurrent writes. The comment above the method claimed keyset
 * pagination, which is how it survived two re-verifications.
 *
 * These assert the query rather than the database: what changed is which
 * clauses are sent, and each fails against the old implementation. The
 * duplicate-row behaviour itself needs two rows sharing a timestamp.
 */

const findMany = vi.fn();
const prisma = { user: { findMany } };
const revokeAllForUser = vi.fn();
const svc = new UsersService(prisma as never, { revokeAllForUser } as never);

const query = (cursor?: string) =>
  ({
    limit: 10,
    cursor,
    role: undefined,
    kycStatus: undefined,
    country: undefined,
    search: undefined,
  }) as unknown as ListUsersDto;

/**
 * The arguments `findMany` was called with. Defaults to the most recent call —
 * an earlier version of this helper read call 0 always, so assertions after a
 * second call silently tested the first one.
 */
const sent = (which: number | 'last' = 'last') =>
  (which === 'last' ? findMany.mock.calls.at(-1) : findMany.mock.calls[which])?.[0] ?? {};

const row = (id: string, createdAt: Date) => ({
  id,
  email: `${id}@example.com`,
  role: 'user',
  status: 'active',
  country: null,
  region: null,
  kycStatus: 'not_started',
  createdAt,
  lastLoginAt: null,
  _count: { wallets: 0, devices: 0 },
});

beforeEach(() => findMany.mockReset());

describe('query shape', () => {
  it('sorts on the whole key, timestamp then id', async () => {
    findMany.mockResolvedValue([]);
    await svc.list(query());
    expect(sent().orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });

  it('does not use Prisma cursor pagination at all', async () => {
    findMany.mockResolvedValue([]);
    await svc.list(query(encodeCursor({ id: 'usr_1', at: new Date() })));
    // `cursor` + `skip: 1` was the bug: it positions on the primary key while
    // the sort is on the timestamp.
    expect(sent()).not.toHaveProperty('cursor');
    expect(sent()).not.toHaveProperty('skip');
  });

  it('applies the keyset filter to `where`, not to the call', async () => {
    // The first draft of the fix spread it at the top level of `findMany`, so
    // Prisma ignored it and every page returned the same rows. This is the
    // assertion that caught it.
    findMany.mockResolvedValue([]);
    const at = new Date('2026-10-08T09:00:00.000Z');
    await svc.list(query(encodeCursor({ id: 'usr_last', at })));

    expect(sent().where?.AND?.[0]?.OR).toEqual([
      { createdAt: { lt: at } },
      { createdAt: at, id: { lt: 'usr_last' } },
    ]);
  });

  it('sends no keyset filter on the first page', async () => {
    findMany.mockResolvedValue([]);
    await svc.list(query());
    expect(sent().where).not.toHaveProperty('OR');
    expect(sent().where).not.toHaveProperty('AND');
  });

  it('keeps the search filter alongside the keyset', async () => {
    // `where` ORs across email and displayName when searching. The keyset has
    // to nest under AND or a spread would replace that OR and the search would
    // silently stop filtering.
    findMany.mockResolvedValue([]);
    await svc.list({ ...query(), search: 'ada' });

    expect(sent(0).where?.OR).toBeDefined();
    expect(sent(0).where).not.toHaveProperty('AND');

    await svc.list({
      ...query(encodeCursor({ id: 'usr_1', at: new Date() })),
      search: 'ada',
    });
    // Search filter intact *and* the keyset present — both, not one replacing
    // the other.
    expect(sent().where?.OR).toBeDefined();
    expect(sent().where?.AND).toBeDefined();
  });

  it('asks for one row more than the page, so "is there more" is answerable', async () => {
    findMany.mockResolvedValue([]);
    await svc.list(query());
    expect(sent().take).toBe(11);
  });
});

describe('response', () => {
  it('returns an opaque cursor that decodes to the last row', async () => {
    const at = new Date('2026-10-08T09:00:00.000Z');
    findMany.mockResolvedValue(Array.from({ length: 11 }, (_, i) => row(`r${i}`, at)));

    const page = await svc.list(query());

    expect(page.items).toHaveLength(10);
    // Not a raw id: a client that can build a cursor can order the list however
    // it likes, which is what encoding a timestamp invites.
    expect(page.nextCursor).not.toBe('r9');
    const back = decodeCursor(page.nextCursor as string);
    expect(back.id).toBe('r9');
    expect(back.at.getTime()).toBe(at.getTime());
  });

  it('returns no cursor on the last page', async () => {
    findMany.mockResolvedValue([row('only', new Date())]);
    const page = await svc.list(query());
    expect(page.nextCursor).toBeNull();
  });

  it('rejects a cursor it did not issue', async () => {
    findMany.mockResolvedValue([]);
    const err = await svc.list(query('usr_raw_id_not_a_cursor')).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(400);
  });
});

describe('status changes', () => {
  function localSvc() {
    const update = vi.fn().mockResolvedValue({});
    const findUnique = vi.fn().mockResolvedValue({ id: 'u1' });
    const revoked: string[] = [];
    const auth = { revokeAllForUser: vi.fn(async (id: string) => { revoked.push(id); return 1; }) };
    const local = new UsersService({ user: { update, findUnique } } as never, auth as never);
    return { local, update, auth, revoked };
  }

  it('revokes every session when an account is suspended', async () => {
    const { local, auth } = localSvc();
    await local.setStatus('u1', 'suspended');
    expect(auth.revokeAllForUser).toHaveBeenCalledWith('u1');
  });

  it('revokes every session when an account is closed', async () => {
    const { local, auth } = localSvc();
    await local.setStatus('u1', 'closed');
    expect(auth.revokeAllForUser).toHaveBeenCalledWith('u1');
  });

  it('leaves sessions alone on reactivation', async () => {
    const { local, auth } = localSvc();
    await local.setStatus('u1', 'active');
    expect(auth.revokeAllForUser).not.toHaveBeenCalled();
  });
});
