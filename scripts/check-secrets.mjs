#!/usr/bin/env node
/**
 * Scan the tree for secret-shaped values outside test fixtures — BE-1703.
 *
 * Three rules, each with its exclusions stated rather than silent:
 *
 *  1. PEM private key blocks anywhere. No legitimate file in this repository
 *     holds one — not docs, not fixtures, nowhere. No exclusions.
 *  2. Key-material assignments (`PRIVATE_KEY|MNEMONIC|SEED_PHRASE` followed
 *     by `=`). Excluded: `packages/security/src/index.ts`, which is the
 *     redactor naming what it redacts — flagging the denylist itself would
 *     force the redactor to stop naming its patterns. Docs were reworded to
 *     avoid the literal sequence rather than excluded: an exclusion for all
 *     of docs/ would let a pasted key sit in a markdown file forever.
 *  3. Vendor token shapes (`sk-live-`, `AKIA…`, `ghp_…`, `persona_*`,
 *     `whsec_*` and kin). Excluded: spec/test/__tests__ trees, whose
 *     fixtures use obvious fakes (`persona_key_123`). Anything shaped like
 *     a credential anywhere else — including docs — fails. Template ids
 *     (`itmpl_…`) are deliberately not matched: they are identifiers, not
 *     credentials, and flagging them would cry wolf on every template
 *     reference in tracker prose.
 *
 * Usage: node scripts/check-secrets.mjs [--root <path>]
 * Tests and docs stay clean by construction; if this fails on a new match,
 * either a secret leaked (rotate it — the finding existing means it is
 * already exposed) or a new legitimate shape needs an exclusion with a
 * reason written here, not silently.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SKIP_DIRS = new Set(['node_modules', '.git', '.claude', 'dist', '.next', '.turbo', 'coverage']);

const PEM = /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/;
const KEY_MATERIAL = /(PRIVATE_KEY|MNEMONIC|SEED_PHRASE)\s*=/;
const TOKEN_SHAPES = /(sk-live-[A-Za-z0-9]+|sk-test-[A-Za-z0-9]{10,}|AKIA[0-9A-Z]{16}|xox[bap]-[A-Za-z0-9-]+|ghp_[A-Za-z0-9]{36}|gho_[A-Za-z0-9]{36}|persona_[A-Za-z0-9_]{8,}|whsec_[A-Za-z0-9_]{8,})/;

const KEY_MATERIAL_EXCLUDE = ['packages/security/src/index.ts'];
const TOKEN_EXCLUDE = [/\.spec\.ts$/, /\.test\.ts$/, /(^|\/)test\//, /__tests__\//];

function excluded(path, patterns) {
  return patterns.some((p) => (typeof p === 'string' ? path === p : p.test(path)));
}

function walk(root, out = []) {
  for (const entry of readdirSync(root)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(root, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, out);
    else if (st.isFile()) out.push(full);
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const rootFlag = args.find((a) => a.startsWith('--root='));
  const root = rootFlag ? rootFlag.slice('--root='.length) : process.cwd();

  const findings = [];
  for (const file of walk(root)) {
    const rel = relative(root, file);
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    // Binary guard: a NUL byte means this is not text we can judge.
    if (text.includes('\0')) continue;
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      if (PEM.test(line)) findings.push(`${rel}:${i + 1}: private key block`);
      if (!excluded(rel, KEY_MATERIAL_EXCLUDE) && KEY_MATERIAL.test(line)) {
        findings.push(`${rel}:${i + 1}: key-material assignment`);
      }
      if (!excluded(rel, TOKEN_EXCLUDE) && TOKEN_SHAPES.test(line)) {
        findings.push(`${rel}:${i + 1}: secret-shaped token`);
      }
    });
  }

  if (findings.length > 0) {
    console.error('\n  check-secrets: possible leaked secrets\n');
    for (const f of findings) console.error(`  ${f}`);
    console.error(
      '\n  If this is a real secret it is already exposed: rotate it, then remove it. ' +
        'If it is a false positive, add an exclusion with a reason in this script — not silently.\n',
    );
    process.exit(1);
  }
  console.log('  check-secrets OK — no secret-shaped values outside test fixtures');
}

main();
