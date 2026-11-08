import { describe, expect, it } from 'vitest';
import { deriveAssetId, assetsEqual, findAsset, describeBacking } from '../index.js';
import type { Asset } from '@correnthian/types';

const usdtEth = { chainId: 1, contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7', issuerId: 'tether' };
const usdtTron = { chainId: 'tron', contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', issuerId: 'tether' };

describe('asset identity', () => {
  it('treats the same symbol on two chains as two different assets', () => {
    expect(deriveAssetId(usdtEth)).not.toBe(deriveAssetId(usdtTron));
  });

  it('is case-insensitive on contract address', () => {
    const upper = { ...usdtEth, contractAddress: usdtEth.contractAddress.toUpperCase() };
    expect(assetsEqual(usdtEth, upper)).toBe(true);
  });

  it('names native assets without a contract slot', () => {
    expect(deriveAssetId({ chainId: 1, contractAddress: null, issuerId: 'protocol' }))
      .toBe('1:native:protocol');
  });
});

const paxg: Asset = {
  assetId: '1:0x45804880de22913dafe09f4980848ece6ecbaf78:paxos',
  chainId: 1,
  contractAddress: '0x45804880De22913dafe09f4980848ece6ECBaF78',
  tokenStandard: 'erc20',
  symbol: 'PAXG',
  name: 'Paxos Gold',
  decimals: 18,
  // `enabled` was never typechecked: `tsconfig.package.json` excludes
  // `src/**/__tests__/**`, so no test in any package reached tsc.
  enabled: true,
  issuer: { issuerId: 'paxos', issuerName: 'Paxos Trust Company', jurisdiction: 'US-NY', licenseRefs: [] },
  backing: {
    custodyModel: 'allocated', custodian: 'Brink\'s', vaultLocation: ['London'],
    proofOfReserve: null, attestationCadence: 'monthly', lastAttestation: '2026-09-30',
    gramsPerToken: null, ouncesPerToken: 1,
  },
  trust: { verifiedTier: 'issuer-verified', riskFlags: [] },
  trading: { rails: ['provider', 'dex'], transferSupported: true, swapSupported: true, redeemSupported: true },
  display: { iconSet: null, accentColor: '#C9A227', category: 'metal' },
};

describe('registry lookup', () => {
  it('finds an asset by its derived id', () => {
    expect(findAsset([paxg], {
      chainId: 1, contractAddress: paxg.contractAddress!.toLowerCase(), issuerId: 'paxos',
    })).toBeDefined();
  });
});

describe('backing disclosure', () => {
  it('never presents a synthetic token as metal', () => {
    expect(describeBacking({ ...paxg, backing: { ...paxg.backing, custodyModel: 'synthetic' } }))
      .toMatch(/No physical metal/i);
  });

  it('names custodian, vault and attestation date for allocated metal', () => {
    const d = describeBacking(paxg)!;
    expect(d).toMatch(/Allocated/);
    expect(d).toMatch(/Brink/);
    expect(d).toMatch(/2026-09-30/);
  });

  it('says "never attested" rather than omitting the gap', () => {
    expect(describeBacking({ ...paxg, backing: { ...paxg.backing, lastAttestation: null } }))
      .toMatch(/never attested/i);
  });

  it('keeps the unallocated sentence for metal', () => {
    expect(describeBacking({ ...paxg, backing: { ...paxg.backing, custodyModel: 'unallocated' } }))
      .toBe('Backed in aggregate. No specific metal is reserved for the holder.');
  });

  it('does not describe a non-metal unallocated asset as metal', () => {
    const disclosure = describeBacking({
      ...paxg,
      symbol: 'USDC',
      display: { ...paxg.display, category: 'stablecoin' },
      backing: { ...paxg.backing, custodyModel: 'unallocated', gramsPerToken: null, ouncesPerToken: null },
    });
    expect(disclosure).toBe('Backed in aggregate. No specific asset is reserved for the holder.');
    expect(disclosure).not.toMatch(/metal/i);
  });
});
