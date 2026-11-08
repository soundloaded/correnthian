import { PUBLIC_CATALOG, catalogAssetId } from './public-catalog.js';

it('registers the three public assets as unverified and not redeemable', () => {
  const symbols = PUBLIC_CATALOG.map((e) => e.asset.symbol).sort();
  expect(symbols).toEqual(['PAXG', 'USDC', 'XAUT']);
  for (const entry of PUBLIC_CATALOG) {
    expect(entry.asset.verifiedTier).toBe('unverified');
    expect(entry.issuer.slug).toMatch(/^[a-z0-9-]+$/);
    expect(entry.asset.redeemSupported).toBe(false);
    expect(entry.asset.chainId).toBe('1');
    expect(catalogAssetId(entry)).toBe(
      `1:${entry.asset.contractAddress!.toLowerCase()}:${entry.issuer.slug}`,
    );
  }
  const metals = PUBLIC_CATALOG.filter((e) => e.asset.category === 'metal');
  expect(metals).toHaveLength(2);
  for (const metal of metals) {
    expect(metal.asset.custodyModel).toBe('allocated');
    expect(metal.asset.ouncesPerToken).toBe(1);
    expect(metal.asset.swapSupported).toBe(true);
    expect(metal.asset.rails).toEqual(['dex']);
  }
});
