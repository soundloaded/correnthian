import { describe, expect, it } from 'vitest';
import type { Prisma } from './generated/prisma/client.js';
import { toDomainAsset } from './assets.mapper.js';

const row = {
  id: 'a1',
  assetId: '1:0xabc:paxos',
  chainId: '1',
  contractAddress: '0xABC',
  tokenStandard: 'erc20',
  symbol: 'PAXG',
  name: 'Paxos Gold',
  decimals: 18,
  category: 'metal',
  issuerId: 'i1',
  issuer: {
    id: 'i1', createdAt: new Date(), updatedAt: new Date(),
    slug: 'paxos', name: 'Paxos Trust Company', jurisdiction: 'US-NY',
    licenseTypes: [], licenseRefs: [], website: null,
    verifiedTier: 'issuer_verified', riskFlags: [], notes: null,
  },
  custodyModel: 'allocated',
  custodian: "Brink's",
  vaultLocations: ['London'],
  proofOfReserveUrl: null,
  attestationCadence: 'monthly',
  lastAttestedAt: new Date('2026-09-30'),
  gramsPerToken: null,
  ouncesPerToken: 1,
  transferSupported: true,
  swapSupported: true,
  redeemSupported: true,
  rails: ['provider', 'dex'],
  verifiedTier: 'issuer_verified',
  riskFlags: [],
  iconUrl: null,
  accentColor: '#C9A227',
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as Prisma.AssetGetPayload<{ include: { issuer: true } }>;

describe('toDomainAsset', () => {
  const asset = toDomainAsset(row);

  it('translates the snake_case trust tier to the domain kebab-case value', () => {
    expect(asset.trust.verifiedTier).toBe('issuer-verified');
  });

  it('maps issuer slug to the domain issuerId', () => {
    expect(asset.issuer.issuerId).toBe('paxos');
  });

  it('converts Decimal columns to numbers', () => {
    expect(asset.backing.ouncesPerToken).toBe(1);
  });

  it('renders the attestation date as an ISO string', () => {
    expect(asset.backing.lastAttestation).toBe('2026-09-30T00:00:00.000Z');
  });

  it('preserves the backing model rather than defaulting it', () => {
    expect(asset.backing.custodyModel).toBe('allocated');
    expect(asset.backing.custodian).toBe("Brink's");
  });
});
