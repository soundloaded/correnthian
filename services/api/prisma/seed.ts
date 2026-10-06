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
