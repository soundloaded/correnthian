/**
 * Development seed.
 *
 * Scope is deliberately small and factual. It does NOT seed invented metals
 * with real issuer, custodian or vault names — an unverified row in the
 * registry is indistinguishable from a verified one once it reaches a user,
 * and that is exactly the failure this product exists to prevent.
 *
 * Real metals assets get added through the API, by a human, from due diligence.
 */

import 'dotenv/config';
import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString:
      process.env.DATABASE_URL ??
      'postgresql://correnthian:correnthian_dev@localhost:5433/correnthian',
  }),
});

async function main() {
  // --- chains (chain IDs are public facts) -------------------------------
  const chains = [
    { id: '1',    name: 'Ethereum', family: 'evm', nativeSymbol: 'ETH', decimals: 18, enabled: true,  isTestnet: false, explorerUrl: 'https://etherscan.io' },
    { id: '8453', name: 'Base',    family: 'evm', nativeSymbol: 'ETH', decimals: 18, enabled: true,  isTestnet: false, explorerUrl: 'https://basescan.org' },
    { id: '11155111', name: 'Ethereum Sepolia', family: 'evm', nativeSymbol: 'ETH', decimals: 18, enabled: false, isTestnet: true, explorerUrl: 'https://sepolia.etherscan.io' },
  ] as const;

  for (const chain of chains) {
    await prisma.chain.upsert({
      where: { id: chain.id },
      update: { name: chain.name, family: chain.family, nativeSymbol: chain.nativeSymbol, decimals: chain.decimals },
      create: { ...chain, rpcUrls: [] },
    });
  }
  console.log(`  chains: ${chains.length}`);

  // --- provider shells (no credentials, no health claims) -----------------
  // Registered as disabled. A provider becomes active only when a human has
  // completed due diligence and signed a contract.
  const providers: Array<{ slug: string; name: string; category: 'metals' | 'onramp'; capabilities: string[] }> = [
    { slug: 'placeholder-metals', name: 'Metals provider (not selected)', category: 'metals', capabilities: [] },
    { slug: 'placeholder-onramp',  name: 'Fiat on-ramp (not selected)',   category: 'onramp', capabilities: [] },
  ];

  for (const p of providers) {
    await prisma.provider.upsert({
      where: { slug: p.slug },
      update: {},
      create: { ...p, status: 'disabled', notes: 'Placeholder. Replace once a provider is contracted.' },
    });
  }
  console.log(`  providers: ${providers.length} (disabled)`);

  // --- jurisdiction ------------------------------------------------------
  // Deny-by-default means the system refuses everything until a rule exists.
  // This development rule exists so the stack is usable locally; it is NOT a
  // legal position and must be replaced with counsel-reviewed rules before
  // any deployment. See docs/compliance/overview.md.
  await prisma.jurisdictionRule.upsert({
    where: { country_region: { country: 'US', region: '' } },
    update: {},
    create: {
      country: 'US',
      region: '',
      canBuyCrypto: true,
      canSellCrypto: true,
      canUseMetals: true,
      canRedeem: false,   // redemption stays off until a provider supports it
      kycRequired: true,
      notes: 'DEVELOPMENT ONLY. Placeholder for counsel-reviewed rules.',
    },
  });
  console.log('  jurisdiction: US (development placeholder)');


  // --- development fixtures ----------------------------------------------
  //
  // Test suites need assets to assert against, and they refuse to pass
  // vacuously against an empty registry — which is the right design. This is
  // NOT the fabricated-metal case the module header warns about: nothing here
  // claims a real custodian or a real issuer. Everything is named as a fixture
  // and starts unverified with synthetic backing, so it can never be mistaken
  // for a metals asset that reached the registry through due diligence.
  const fixtureIssuer = await prisma.issuer.upsert({
    where: { slug: 'dev-fixtures' },
    update: {},
    create: {
      slug: 'dev-fixtures',
      name: 'DEVELOPMENT FIXTURES (not a real issuer)',
      jurisdiction: 'XX',
      licenseTypes: [],
      licenseRefs: [],
      verifiedTier: 'unverified',
      riskFlags: ['dev-fixture'],
      notes: 'Created by the dev seed so test suites have something to assert against.',
    },
  });

  const fixtures = [
    { symbol: 'tUSDT', name: 'Test USD (fixture)', contract: '0x0000000000000000000000000000000000000001', decimals: 6, category: 'stablecoin' },
    { symbol: 'tGOLD', name: 'Test Gold Lookalike (fixture)', contract: '0x0000000000000000000000000000000000000002', decimals: 18, category: 'metal' },
  ] as const;

  for (const f of fixtures) {
    const assetId = `1:${f.contract}:dev-fixtures`;
    await prisma.asset.upsert({
      where: { assetId },
      update: { enabled: true },
      create: {
        assetId,
        chainId: '1',
        contractAddress: f.contract,
        tokenStandard: 'erc20',
        symbol: f.symbol,
        name: f.name,
        decimals: f.decimals,
        category: f.category,
        issuerId: fixtureIssuer.id,
        // Synthetic on purpose. A fixture must never read as backed metal.
        custodyModel: 'synthetic',
        attestationCadence: 'none',
        lastAttestedAt: null,
        rails: ['dex'],
        swapSupported: true,
        transferSupported: true,
        redeemSupported: false,
        verifiedTier: 'unverified',
        riskFlags: ['dev-fixture'],
        enabled: true,
      },
    });
  }
  console.log(`  fixtures: ${fixtures.length} assets (synthetic, unverified, clearly named)`);

  // --- first admin -------------------------------------------------------
  const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? '';

  if (!email || !password) {
    console.log('  admin: skipped — set ADMIN_EMAIL and ADMIN_PASSWORD to bootstrap one');
    return;
  }
  // The floor is configurable so local development can use a short throwaway
  // password without changing the production default. Defaults to 12, which
  // is the real requirement — do not lower it for anything that is not a
  // disposable local database.
  const minLength = Number(process.env.ADMIN_PASSWORD_MIN_LENGTH ?? '12');
  if (!Number.isFinite(minLength) || minLength < 8) {
    throw new Error('ADMIN_PASSWORD_MIN_LENGTH must be 8 or more');
  }
  if (password.length < minLength) {
    throw new Error(`ADMIN_PASSWORD must be at least ${minLength} characters`);
  }

  // The contract and idempotency suites default to this account locally, so
  // the dev seed must create it or they fail with an error that looks like an
  // auth bug. CI overrides with its own throwaway account.
  const TEST_DEFAULT_EMAIL = 'admin@correnthian.local';
  // Keep in step with the fallback in contracts.spec.ts and idempotency.spec.ts.
  await prisma.user.upsert({
    where: { email: TEST_DEFAULT_EMAIL },
    update: {},
    create: {
      email: TEST_DEFAULT_EMAIL,
      // Matches the suite's documented local default in contracts.spec.ts.
      passwordDigest: await hash('correct-horse-battery-staple', { memoryCost: 65536, timeCost: 3, parallelism: 1 }),
      role: 'admin',
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`  admin: ${TEST_DEFAULT_EMAIL} (test-suite default)`);

  const digest = await hash(password, { memoryCost: 65536, timeCost: 3, parallelism: 1 });
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordDigest: digest, role: 'admin', emailVerifiedAt: new Date() },
    select: { email: true, role: true },
  });
  console.log(`  admin: ${user.email} (${user.role})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
