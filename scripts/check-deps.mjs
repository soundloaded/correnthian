#!/usr/bin/env node
/**
 * Gate production dependencies on known advisories — BE-1703.
 *
 * `pnpm audit` reports severity, not reachability: all four current highs
 * are build/dev-tooling chains (Prisma CLI internals, expo and shadcn
 * scaffolding) that never process remote input at runtime. A naive gate on
 * "any high" would fail on those forever and teach everyone to ignore it —
 * a guard that cries wolf gets switched off, and then it catches nothing.
 *
 * So this gates on *unreviewed* highs and criticals instead. Every advisory
 * at those severities must either be fixed or carry an entry below naming
 * why it cannot reach production traffic. A new advisory fails the build
 * until a human triages it here. The allowlist is keyed by GHSA id, not by
 * package name, so an upgrade that fixes one stops matching silently while
 * a *new* advisory on the same package still fails.
 *
 * Usage: node scripts/check-deps.mjs [--audit-file <path>]
 * Without the flag it runs `pnpm audit --prod --json` itself; the flag
 * exists so the spec can feed it fixture output deterministically.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const GATED = new Set(['high', 'critical']);

/**
 * Advisory id → why it cannot reach production traffic. Each entry must
 * name the chain and the reason remoteness is impossible, not just the
 * package — "devDependency" alone is not a reason when the audit already
 * scopes to --prod.
 */
const ALLOWLIST = new Map([
  [
    'GHSA-ggr8-5vv4-36mx',
    'deepmerge-ts (high) via @prisma/client > prisma CLI config merging. ' +
      'Only merges local env-derived config at build/migrate time; the ' +
      'running API never merges attacker-controlled graphs through it.',
  ],
  [
    'GHSA-3f6p-5ww8-9rcr',
    'mysql2 auth downgrade (high) via Prisma CLI MySQL support. We connect ' +
      'Postgres only; mysql2 code never loads without a mysql datasource, ' +
      'which no schema here declares.',
  ],
  [
    'GHSA-86w9-cpqp-85rv',
    'node-forge RSA (high) via expo CLI for the framework-default mobile ' +
      'app. Build-time tooling; not shipped, not served.',
  ],
  [
    // Alias of the above: pnpm reports both ids for the same advisory, and
    // an allowlist keyed by id must name every spelling stunt doubles come
    // in, or the same triaged advisory fails under its other name.
    'GHSA-ppp5-5v6c-4jwp',
    'Alias of GHSA-86w9-cpqp-85rv (same node-forge advisory, same chain).',
  ],
  [
    'GHSA-vfj7-8cjw-p6xm',
    'braces (high) via shadcn/eslint scaffolding chains. Processes our own ' +
      'file paths at build time, never remote input.',
  ],
]);

function advisories(auditJson) {
  const out = [];
  const advisories = auditJson?.advisories ?? {};
  for (const entry of Object.values(advisories)) {
    const severity = entry?.severity;
    if (!GATED.has(severity)) continue;
    const ids = new Set(
      (JSON.stringify(entry?.references ?? '')).match(/GHSA-[a-z0-9-]+/g) ?? [],
    );
    const title = (entry?.title ?? '').split('\n')[0];
    if (ids.size === 0) {
      out.push({ ghsa: '(unidentified)', severity, title });
      continue;
    }
    for (const ghsa of ids) out.push({ ghsa, severity, title });
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const fileFlag = args.find((a) => a.startsWith('--audit-file='));

  let raw;
  if (fileFlag) {
    raw = readFileSync(fileFlag.slice('--audit-file='.length), 'utf8');
  } else {
    try {
      raw = execSync('pnpm audit --prod --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      // `pnpm audit` exits non-zero when advisories exist — but stdout still
      // carries the JSON. Anything else (no network, no lockfile) is a hard
      // error, not a pass: a gate that cannot read is not a gate.
      raw = err?.stdout;
      if (typeof raw !== 'string' || raw.length === 0) {
        console.error(`\n  check-deps: could not run pnpm audit: ${err?.message ?? err}\n`);
        process.exit(2);
      }
    }
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error('\n  check-deps: pnpm audit did not return JSON\n');
    process.exit(2);
  }

  const found = advisories(parsed);
  const unknown = found.filter((a) => !ALLOWLIST.has(a.ghsa));

  if (unknown.length > 0) {
    console.error('\n  check-deps: untriaged production advisories (high/critical)\n');
    for (const a of unknown) {
      console.error(`  [${a.severity}] ${a.ghsa} — ${a.title}`);
    }
    console.error(
      '\n  Triage it in scripts/check-deps.mjs ALLOWLIST with the chain and why ' +
        'it cannot reach production traffic — or fix the dependency. ' +
        'A new advisory fails until a human looks at it.\n',
    );
    process.exit(1);
  }

  const stale = [...ALLOWLIST.keys()].filter((id) => !found.some((a) => a.ghsa === id));
  console.log(
    `  check-deps OK — ${found.length} gated ${found.length === 1 ? 'advisory' : 'advisories'}, ` +
      `all triaged${stale.length > 0 ? ` (${stale.length} allowlist ${stale.length === 1 ? 'entry' : 'entries'} no longer matching: ${stale.join(', ')})` : ''}`,
  );
}

main();
