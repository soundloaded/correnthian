#!/usr/bin/env node
/**
 * Enforce the key boundary in CI.
 *
 * `packages/wallet-core` holds key derivation and signing. Its safety claim —
 * that private keys cannot reach Correnthian's servers — is only true if it
 * has no way to talk to a network in the first place. Nothing enforces that
 * except this check, so a well-meaning `pnpm add axios` there would silently
 * dissolve the property the entire threat model rests on.
 *
 * The existing `secret-scan` job guards *credentials* in env files. That is a
 * different property. This guards the *boundary*.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const PROTECTED = 'packages/wallet-core';

/** Anything that could carry key material off the device, or couple it to a UI. */
const FORBIDDEN = [
  // network / transport
  'axios', 'node-fetch', 'got', 'superagent', 'undici', 'ws',
  // provider and chain SDKs — these are server-side by nature
  '@metamask/sdk', 'viem', 'ethers', '@solana/web3.js', 'bitcoinjs-lib',
  'tronweb', '@walletconnect/*',
  // UI frameworks the key container must never depend on
  'react', 'react-dom', 'react-native', 'next', 'expo', 'react-native-keychain',
  'expo-secure-store',
  // server frameworks
  '@nestjs/*', 'express', 'fastify',
];

/** Workspace packages this one is allowed to reach. */
const ALLOWED_WORKSPACE = ['@correnthian/types'];

const fail = (msg) => {
  console.error(`\n  KEY BOUNDARY VIOLATION\n  ${msg}\n`);
  process.exitCode = 1;
};

const readPkg = (dir) => {
  const p = join(ROOT, dir, 'package.json');
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf-8'));
};

/** Walk the workspace dependency graph from a starting package. */
const closure = (startDir) => {
  const seen = new Set();
  const queue = [startDir];
  const external = new Set();

  while (queue.length) {
    const dir = queue.pop();
    if (seen.has(dir)) continue;
    seen.add(dir);

    const pkg = readPkg(dir);
    if (!pkg) continue;

    for (const [name, range] of Object.entries({
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
      ...(pkg.peerDependencies ?? {}),
    })) {
      if (String(range).startsWith('workspace:')) {
        queue.push(`packages/${name.replace('@correnthian/', '')}`);
      } else {
        external.add(name);
      }
    }
  }
  return external;
};

const pkg = readPkg(PROTECTED);
if (!pkg) {
  fail(`${PROTECTED} has no package.json`);
} else {
  const external = closure(PROTECTED);

  const violations = [...external].filter((name) =>
    FORBIDDEN.some((rule) =>
      rule.endsWith('/*') ? name.startsWith(rule.slice(0, -1)) : name === rule,
    ),
  );

  if (violations.length) {
    fail(
      `${PROTECTED} must not depend on: ${violations.join(', ')}\n` +
        `  These can carry key material off the device or couple it to a UI.\n` +
        `  Signing must happen locally with no transport available.`,
    );
  } else {
    console.log(`  key boundary OK — ${PROTECTED} reaches ${external.size} external packages, none forbidden`);
    console.log(`  workspace deps allowed: ${ALLOWED_WORKSPACE.join(', ')}`);
  }
}
