import { describe, expect, it, vi } from 'vitest';
import { deriveAssetId } from '@correnthian/assets';
import { AppError } from '../common/errors.js';
import { AssetsService } from './assets.service.js';

/**
 * AssetsService with a fake store — batch B gap.
 *
 * Pins that identity is derived (the caller cannot choose an assetId), that
 * registration against an unknown issuer is 404 rather than a dangling row,
 * and that a duplicate derivation is 409. Mapping and disclosure have their
 * own spec; this one owns the write guards.
 */
const dto = (over: Record<string, unknown> = {}) => ({
  chainId: '1', contractAddress: '0xABC', tokenStandard: 'erc20', symbol: 'tst',
  name: 'Test Gold', decimals: 18, category: 'metal', issuerId: 'mint',
  custodyModel: 'allocated', custodian: null, vaultLocations: [],
  proofOfReserveUrl: null, attestationCadence: 'none', lastAttestedAt: null,
  ouncesPerToken: null, gramsPerToken: null, rails: [], swapSupported: false,
  redeemSupported: false, verifiedTier: 'unverified', accentColor: null, iconUrl: null,
  ...over,
});

function makePrisma(over: { existingAsset?: boolean; issuer?: boolean } = {}) {
  const created: Record<string, unknown>[] = [];
  return {
    created,
    asset: {
      findUnique: vi.fn(async () => (over.existingAsset ? { id: 'row-1' } : null)),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return { ...data, id: 'row-1', issuer: { id: 'iss-1', slug: 'mint' } };
      }),
    },
    issuer: {
      findUnique: vi.fn(async () => (over.issuer === false ? null : { id: 'iss-1', slug: 'mint' })),
    },
  };
}

const svc = (p: ReturnType<typeof makePrisma>) => new AssetsService(p as never);

describe('asset registration guards', () => {
  it('derives the identity and normalises case, ignoring caller naming', async () => {
    const p = makePrisma();
    await svc(p).create(dto() as never);
    const data = p.created[0]!;
    expect(data['assetId']).toBe(deriveAssetId({ chainId: '1', contractAddress: '0xABC', issuerId: 'mint' }));
    expect(data['assetId']).toBe('1:0xabc:mint');
    expect(data['contractAddress']).toBe('0xabc');
    expect(data['symbol']).toBe('TST');
  });

  it('refuses an unknown issuer with 404, writing nothing', async () => {
    const p = makePrisma({ issuer: false });
    const err = await svc(p).create(dto() as never).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(404);
    expect(p.created).toHaveLength(0);
  });

  it('refuses a duplicate derivation with 409', async () => {
    const p = makePrisma({ existingAsset: true });
    const err = await svc(p).create(dto() as never).catch((e: unknown) => e);
    expect((err as AppError).status).toBe(409);
    expect(p.created).toHaveLength(0);
  });
});
