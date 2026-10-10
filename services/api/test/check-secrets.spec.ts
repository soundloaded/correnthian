import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/**
 * `scripts/check-secrets.mjs` — the scan, and proof it still scans.
 *
 * A secret scanner's value is entirely in failing: a clean run says
 * nothing on its own. So these plant each secret shape in turn and assert
 * the script names the file and line — and plant the same shapes where
 * they are legitimate (test fixtures) and assert it stays quiet.
 */

const SCRIPT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../scripts/check-secrets.mjs',
);

interface Run {
  status: number;
  out: string;
}

function run(files: Record<string, string>): Run {
  const root = mkdtempSync(join(tmpdir(), 'check-secrets-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      const full = join(root, rel);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content);
    }
    const res = spawnSync(process.execPath, [SCRIPT, `--root=${root}`], {
      encoding: 'utf8',
    });
    return { status: res.status ?? -1, out: `${res.stdout}${res.stderr}` };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('check-secrets', () => {
  it('passes a clean tree', () => {
    const r = run({
      'src/index.ts': 'export const x = 1;\n',
      'docs/notes.md': 'nothing secret here\n',
    });
    expect(r.status).toBe(0);
    expect(r.out).toContain('check-secrets OK');
  });

  it('fails a PEM private key block and names file and line', () => {
    const r = run({ 'config/tls.conf': 'key:\n-----BEGIN RSA ' + 'PRIVATE KEY-----\nabc\n' });
    expect(r.status).toBe(1);
    expect(r.out).toContain('config/tls.conf:2');
  });

  it('fails key-material assignments outside env files too', () => {
    const r = run({ 'deploy.sh': 'export MNEMON' + 'IC="word ".repeat(12)\n' });
    expect(r.status).toBe(1);
    expect(r.out).toContain('deploy.sh:1');
  });

  it('fails a vendor token shape in source', () => {
    const r = run({ 'src/client.ts': 'const key = "whsec_live_abc123XYZ789";\n' });
    expect(r.status).toBe(1);
    expect(r.out).toContain('src/client.ts:1');
  });

  it('fails a token shape in docs: documentation is not an exclusion', () => {
    // An exclusion for all of docs/ would let a pasted key sit in a
    // markdown file forever. Docs that describe a pattern were reworded
    // instead — see the four doc lines changed with this script.
    const r = run({ 'docs/setup.md': 'paste your key: whsec_live_abc123XYZ789\n' });
    expect(r.status).toBe(1);
  });

  it('stays quiet on obvious test fakes', () => {
    const r = run({
      'src/auth.spec.ts': 'const key = "persona_key_123";\n',
      'test/helper.ts': 'const secret = "whsec_test_123";\n',
    });
    expect(r.status).toBe(0);
  });

  it('stays quiet on the redactor naming its own patterns', () => {
    // packages/security must name SEED_PHRASE to redact it; flagging the
    // denylist itself would force the redactor to stop naming patterns.
    // Asserted by path shape, not content, so the exemption is reviewable
    // in one place (KEY_MATERIAL_EXCLUDE in the script).
    const r = run({
      'packages/security/src/index.ts': 'const SEED_PH' + 'RASE = /x/;\n',
    });
    expect(r.status).toBe(0);
  });
});
