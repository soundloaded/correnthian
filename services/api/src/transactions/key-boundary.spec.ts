import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The key boundary, enforced against the transaction engine rather than
 * asserted in a comment.
 *
 * `docs/architecture/key-boundary.md` names the invariants this codebase
 * "should be making in tests" and notes that most are not implemented. Two of
 * them are in scope for this module:
 *
 *  - nothing reachable from `services/api` may sign;
 *  - no schema column may be capable of holding key material.
 *
 * A rule that lives only in a doc comment decays. These are structural
 * properties of the files as they are on disk, checked on every test run —
 * which is the failure mode the document itself complains about.
 *
 * Scope is honest: this reads *direct imports* in this module's own source. It
 * does not compute a transitive closure, so it cannot catch a signing library
 * arriving through a dependency of a dependency. That is a bigger guard and a
 * separate decision; see the "Open questions" section of key-boundary.md.
 */

const HERE = fileURLToPath(new URL('.', import.meta.url));
const API_ROOT = join(HERE, '..', '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!entry.name.endsWith('.ts')) return [];
    // This file names the forbidden identifiers in order to look for them.
    if (entry.name.endsWith('.spec.ts')) return [];
    return [path];
  });
}

/**
 * Comments are stripped before the identifier scan, because the documentation
 * in this module necessarily *talks about* private keys and signing in order
 * to explain why it does none of it. A guard that cannot tell an import from a
 * paragraph would be turned off within a week.
 *
 * Not a parser: a string literal containing `//` would confuse it. The failure
 * is conservative in the right direction for imports, which are the load-
 * bearing half, and the identifier list below is short and unambiguous.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const IMPORT = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s+['"]([^'"]+)['"]/g;

function importsOf(source: string): string[] {
  // Comments first: a commented-out import is not an import, and a doc block
  // naming a package must not read as a dependency on it.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  return [...code.matchAll(IMPORT)].map((m) => m[1] ?? '');
}

describe('the transaction engine cannot sign', () => {
  const files = sourceFiles(HERE).map((path) => ({ path, source: readFileSync(path, 'utf8') }));

  it('has something to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  /**
   * `wallet-core` is the package that holds `sign(payload)`. If the API's
   * transaction module ever imports it, the architecture is no longer what the
   * threat model describes — and it will not have been a deliberate decision.
   */
  const FORBIDDEN_PACKAGES = [
    '@correnthian/wallet-core',
    'ethers',
    'viem',
    '@solana/web3.js',
    'bitcoinjs-lib',
    '@scure/bip39',
    '@noble/secp256k1',
  ];

  it.each(FORBIDDEN_PACKAGES)('does not import %s', (pkg) => {
    const offenders = files
      .filter((f) => importsOf(f.source).some((i) => i === pkg || i.startsWith(`${pkg}/`)))
      .map((f) => f.path);
    expect(offenders, `${pkg} is reachable from the transaction engine`).toEqual([]);
  });

  /**
   * The API is allowed to *read* a chain — `IndexingService` does, through the
   * adapter package. What it may never gain is a second, ad-hoc way to talk to
   * one, which is how a signing helper gets in without anybody noticing.
   */
  const FORBIDDEN_TRANSPORTS = ['axios', 'node-fetch', 'undici', 'got'];

  it.each(FORBIDDEN_TRANSPORTS)('does not reach for %s directly', (pkg) => {
    const offenders = files
      .filter((f) => importsOf(f.source).some((i) => i === pkg || i.startsWith(`${pkg}/`)))
      .map((f) => f.path);
    expect(offenders, `${pkg} is reached directly from the transaction engine`).toEqual([]);
  });

  /**
   * Anything named like key material, anywhere in the module's code.
   *
   * A function that took one of these would be a function that signs. There is
   * no field on any input type here that could express a seed phrase or a
   * signing share, and that is the property this asserts.
   */
  const FORBIDDEN_IDENTIFIERS = [
    'privateKey',
    'mnemonic',
    'seedPhrase',
    'signingShare',
    'keyShare',
    'signTransaction',
    'signMessage',
    'sendRawTransaction',
    'signedTransaction',
    'rawTransaction',
  ];

  it.each(FORBIDDEN_IDENTIFIERS)('never names %s', (identifier) => {
    const pattern = new RegExp(`\\b${identifier}\\b`, 'i');
    const offenders = files
      .filter((f) => pattern.test(stripComments(f.source)))
      .map((f) => f.path);
    expect(offenders, `"${identifier}" appears in the transaction engine's code`).toEqual([]);
  });
});

describe('the database cannot hold key material', () => {
  const schema = readFileSync(join(API_ROOT, 'prisma', 'schema.prisma'), 'utf8');

  const models = ['Transaction', 'AuditLog'] as const;
  const KEY_SHAPED = /(privateKey|mnemonic|seedPhrase|seed_phrase|signingShare|keyShare|secretKey|signedTx|signedPayload|rawTransaction|signatureShare)/i;

  /** Field lines only: a doc comment naming a private key is the point, not a bug. */
  function fieldNames(model: string): string[] {
    const block = new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`).exec(schema)?.[1] ?? '';
    expect(block, `model ${model} not found in schema.prisma`).not.toBe('');
    return block
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('//') && !line.startsWith('///') && !line.startsWith('@@'))
      .map((line) => line.split(/\s+/)[0] ?? '');
  }

  it.each(models)('%s has no key-shaped column', (model) => {
    const offenders = fieldNames(model).filter((name) => KEY_SHAPED.test(name));
    expect(offenders, `${model} gained a column that could hold key material`).toEqual([]);
  });

  it.each(models)('%s has no field for a signed payload', (model) => {
    // A signature is not key material, so `redactDeep()` will not catch it —
    // but a logged signed transaction is a replayable authorisation while its
    // nonce is unspent, and it leaks exactly what an attacker needs.
    // key-boundary.md item 8.
    // `*At` is this schema's convention for a timestamp, and `signedAt` is a
    // time, not a payload. Excluding it keeps the check aimed at the thing
    // that is actually dangerous.
    const offenders = fieldNames(model).filter(
      (name) => !name.endsWith('At') && /^(signed|raw|serialized|serialised)/i.test(name),
    );
    expect(offenders).toEqual([]);
  });

  it('keeps the transaction hash nullable, because an unsigned intent has none', () => {
    const block = /model Transaction \{([\s\S]*?)\n\}/.exec(schema)?.[1] ?? '';
    expect(block).toMatch(/txHash\s+String\?/);
  });

  it('records the destination as a public address and nothing more', () => {
    const block = /model Transaction \{([\s\S]*?)\n\}/.exec(schema)?.[1] ?? '';
    expect(block).toMatch(/destination\s+String\?/);
  });
});