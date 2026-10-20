import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeCursor, encodeCursor } from '../common/keyset.js';
import type { ListAllDevicesDto } from './dto/list-all-devices.dto.js';
import { DevicesService } from './devices.service.js';

/**
 * DEF-015, the admin list half.
 *
 * Same defect as `users`: ordered by a timestamp, paginated on the primary
 * key. This list sorts on `lastSeenAt` rather than `createdAt`, which is why
 * it cannot borrow the other list's `orderBy` — and why the helper takes the
 * field as a parameter.
 */
const findMany = vi.fn();
const prisma = { device: { findMany } };
const svc = new DevicesService(prisma as never);

const query = (cursor?: string): ListAllDevicesDto => ({
  limit: 5,
  cursor,
  includeRevoked: true,
});

const sent = () => findMany.mock.calls.at(-1)?.[0] ?? {};

const row = (id: string, lastSeenAt: Date) => ({
  id,
  platform: 'ios',
  label: 'phone',
  trustedAt: lastSeenAt,
  lastSeenAt,
  revokedAt: null,
  user: { id: 'u1', email: 'a@example.com', role: 'user', kycStatus: 'not_started' },
});

beforeEach(() => findMany.mockReset());

describe('admin device list pagination', () => {
  it('sorts on both halves of lastSeenAt and id', async () => {
    findMany.mockResolvedValue([]);
    await svc.listAll(query());
    expect(sent().orderBy).toEqual([{ lastSeenAt: 'desc' }, { id: 'desc' }]);
  });

  it('applies the keyset inside `where`, on lastSeenAt', async () => {
    findMany.mockResolvedValue([]);
    const at = new Date('2026-10-08T09:00:00.000Z');
    await svc.listAll(query(encodeCursor({ id: 'dev_last', at })));

    expect(sent().where?.AND?.[0]?.OR).toEqual([
      { lastSeenAt: { lt: at } },
      { lastSeenAt: at, id: { lt: 'dev_last' } },
    ]);
  });

  it('does not paginate with Prisma cursor + skip', async () => {
    findMany.mockResolvedValue([]);
    await svc.listAll(query(encodeCursor({ id: 'dev_last', at: new Date() })));
    expect(sent()).not.toHaveProperty('cursor');
    expect(sent()).not.toHaveProperty('skip');
  });

  it('keeps the platform filter alongside the keyset', async () => {
    findMany.mockResolvedValue([]);
    await svc.listAll({ ...query(encodeCursor({ id: 'd', at: new Date() })), platform: 'ios' });

    expect(sent().where?.platform).toBe('ios');
    expect(sent().where?.AND).toBeDefined();
  });

  it('encodes the cursor against lastSeenAt, not createdAt', async () => {
    const seen = new Date('2026-10-07T12:00:00.000Z');
    findMany.mockResolvedValue(Array.from({ length: 6 }, (_, i) => row(`d${i}`, seen)));

    const page = await svc.listAll(query());

    expect(page.items).toHaveLength(5);
    expect(page.nextCursor).not.toBe('d4');
    const back = decodeCursor(page.nextCursor as string);
    expect(back.id).toBe('d4');
    // The cursor carries the sort value in whatever shape the encoder
    // wrote: a Date for a timestamp order, a string otherwise.
    const backAt = back.at instanceof Date ? back.at : new Date(back.at);
    expect(backAt.getTime()).toBe(seen.getTime());
  });
});
