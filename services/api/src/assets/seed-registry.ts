import type { Asset } from '@correnthian/types';

/**
 * Seed data only. This is not the registry - it is the shape the registry must
 * be able to hold. Deliberately includes a synthetic token so the disclosure
 * path is exercised rather than assumed.
 */
export const SEED_ASSETS: readonly Asset[] = [
  {
    assetId: '1:0x45804880de22913dafe09f4980848ece6ecbaf78:paxos',
    chainId: 1,
    contractAddress: '0x45804880De22913dafe09f4980848ece6ECBaF78',
    tokenStandard: 'erc20',
    symbol: 'PAXG',
    name: 'Paxos Gold',
    decimals: 18,
    issuer: {
      issuerId: 'paxos',
      issuerName: 'Paxos Trust Company',
      jurisdiction: 'US-NY',
      licenseRefs: [],
    },
    backing: {
      custodyModel: 'allocated',
      custodian: "Brink's",
      vaultLocation: ['London'],
      proofOfReserve: null,
      attestationCadence: 'monthly',
      lastAttestation: '2026-09-30',
      gramsPerToken: null,
      ouncesPerToken: 1,
    },
    trust: { verifiedTier: 'issuer-verified', riskFlags: [] },
    trading: {
      rails: ['provider', 'dex'],
      transferSupported: true,
      swapSupported: true,
      redeemSupported: true,
    },
    display: { iconSet: null, accentColor: '#C9A227', category: 'metal' },
  },
  {
    assetId: '1:0x000000000000000000000000000000000000dead:unverified-metals',
    chainId: 1,
    contractAddress: '0x000000000000000000000000000000000000dEaD',
    tokenStandard: 'erc20',
    symbol: 'XAU',
    name: 'Unverified Metals',
    decimals: 18,
    issuer: {
      issuerId: 'unverified-metals',
      issuerName: 'Unknown',
      jurisdiction: 'unknown',
      licenseRefs: [],
    },
    backing: {
      custodyModel: 'synthetic',
      custodian: null,
      vaultLocation: [],
      proofOfReserve: null,
      attestationCadence: 'none',
      lastAttestation: null,
      gramsPerToken: null,
      ouncesPerToken: null,
    },
    trust: { verifiedTier: 'unverified', riskFlags: ['no-attestation', 'synthetic-backing'] },
    trading: {
      rails: ['dex'],
      transferSupported: true,
      swapSupported: true,
      redeemSupported: false,
    },
    display: { iconSet: null, accentColor: null, category: 'metal' },
  },
];
