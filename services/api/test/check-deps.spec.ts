import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/**
 * `scripts/check-deps.mjs` — the gate, and proof it still gates.
 *
 * `pnpm audit` reports severity, not reachability, so the script's whole
 * value is in what it fails on: an untriaged high/critical must fail, and
 * a triaged one must pass. A run that passes says nothing on its own.
 */

const SCRIPT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../scripts/check-deps.mjs',
);

interface Run {
  status: number;
  out: string;
}

function run(auditJson: unknown): Run {
  const root = mkdtempSync(join(tmpdir(), 'check-deps-'));
  try {
    const file = join(root, 'audit.json');
    writeFileSync(file, JSON.stringify(auditJson));
    const res = spawnSync(process.execPath, [SCRIPT, `--audit-file=${file}`], {
      encoding: 'utf8',
    });
    return { status: res.status ?? -1, out: `${res.stdout}${res.stderr}` };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const advisory = (ghsa: string, severity = 'high') => ({
  severity,
  title: `test advisory ${ghsa}`,
  references: `https://github.com/advisories/${ghsa}`,
});

describe('check-deps', () => {
  it('passes a clean audit', () => {
    const r = run({ advisories: {} });
    expect(r.status).toBe(0);
    expect(r.out).toContain('check-deps OK');
  });

  it('passes a triaged advisory and names it as triaged', () => {
    const r = run({ advisories: { a: advisory('GHSA-ggr8-5vv4-36mx') } });
    expect(r.status).toBe(0);
  });

  it('fails an untriaged high and names it', () => {
    const r = run({ advisories: { a: advisory('GHSA-new0-0000-0000') } });
    expect(r.status).toBe(1);
    expect(r.out).toContain('GHSA-new0-0000-0000');
    expect(r.out).toContain('untriaged');
  });

  it('fails an untriaged critical even when highs are triaged', () => {
    const r = run({
      advisories: {
        a: advisory('GHSA-ggr8-5vv4-36mx'),
        b: advisory('GHSA-new1-1111-2222', 'critical'),
      },
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain('GHSA-new1-1111-2222');
  });

  it('ignores moderates and lows: the gate is high/critical, the rest is triage prose', () => {
    const r = run({ advisories: { a: advisory('GHSA-m0d-0000-0000', 'moderate') } });
    expect(r.status).toBe(0);
  });

  it('fails an advisory with no identifiable GHSA rather than passing it', () => {
    // No id means it can never match the allowlist. Passing it would let an
    // advisory through precisely because it is unparsable.
    const r = run({ advisories: { a: { severity: 'high', title: 'mystery', references: '' } } });
    expect(r.status).toBe(1);
    expect(r.out).toContain('(unidentified)');
  });
});
