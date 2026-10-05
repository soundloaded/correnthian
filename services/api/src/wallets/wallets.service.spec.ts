import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WalletsService } from './wallets.service.js';

describe('WalletsService', () => {
  let findUnique: ReturnType<typeof vi.fn>;
  let findFirst: ReturnType<typeof vi.fn>;
  let count: ReturnType<typeof vi.fn>;
  let create: ReturnType<typeof vi.fn>;
  let updateMany: ReturnType<typeof vi.fn>;
  let update: ReturnType<typeof vi.fn>;
  let deleteMany: ReturnType<typeof vi.fn>;
  let svc: WalletsService;

  beforeEach(() => {
    findUnique = vi.fn().mockResolvedValue(null);
    findFirst = vi.fn().mockResolvedValue({ id: 'w1', userId: 'u1' });
    count = vi.fn().mockResolvedValue(1);
    create = vi.fn().mockResolvedValue({ id: 'w1' });
    updateMany = vi.fn().mockResolvedValue({ count: 1 });
    update = vi.fn().mockResolvedValue({ id: 'w1' });
    deleteMany = vi.fn().mockResolvedValue({ count: 1 });

    svc = new WalletsService(
      { wallet: { findUnique, findFirst, count, create, updateMany, update, deleteMany },
        asset: { findUnique: vi.fn() }, walletAccount: { upsert: vi.fn() } } as never,
    );
  });

  const valid = { address: '0xdac17f958d2ee523a2206206994597c13d831ec7', chainId: '1', kind: 'smart' as const };

  it('normalises the address to lowercase before storing', async () => {
    await svc.register('u1', { ...valid, address: valid.address.toUpperCase().replace('0X', '0x') });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ address: valid.address }) }),
    );
  });

  it('rejects a malformed address rather than storing it', async () => {
    await expect(svc.register('u1', { ...valid, address: '0x123' })).rejects.toThrow(/40 hex/);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects an unconfigured chain instead of guessing the family', async () => {
    await expect(svc.register('u1', { ...valid, chainId: '999999' })).rejects.toThrow(/unconfigured chain/);
  });

  it('refuses guardians on a seed account — it has no contract to hold them', async () => {
    await expect(
      svc.register('u1', { ...valid, kind: 'seed', guardians: ['0x' + 'a'.repeat(40)] }),
    ).rejects.toThrow(/Seed accounts cannot have guardians/);
  });

  it('validates each guardian address', async () => {
    await expect(
      svc.register('u1', { ...valid, guardians: ['not-an-address'] }),
    ).rejects.toThrow(/Invalid guardian/);
  });

  it('refuses to confirm an address is already registered', async () => {
    findUnique.mockResolvedValue({ id: 'other' });
    await expect(svc.register('u1', valid)).rejects.toThrow(/already registered/);
  });

  it('rejects a negative balance', async () => {
    await expect(svc.setBalance('u1', 'w1', '1:0xabc:iss', '-1')).rejects.toThrow(/non-negative/);
  });

  it('rejects a balance that is not a decimal string', async () => {
    await expect(svc.setBalance('u1', 'w1', '1:0xabc:iss', '1e18')).rejects.toThrow(/non-negative/);
  });
});
