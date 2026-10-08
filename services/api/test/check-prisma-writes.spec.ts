import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/**
 * `scripts/check-prisma-writes.mjs` — the guard, and proof it still guards.
 *
 * The script exists because `Prisma.XOR` defeats TypeScript's excess-property
 * check, so a typo in any `data` compiles and 500s at runtime. Its whole value
 * is that it fails; a run that passes says nothing on its own, and a guard that
 * has quietly stopped checking is indistinguishable from a working one.
 *
 * So these run it against fixtures where the defect is present and assert it
 * reports the field. Two of the cases are regressions it has actually had:
 *
 *   - a property directly after a comment was swallowed, because whitespace at
 *     depth 1 fell into a fallback that cleared `expectKey`;
 *   - shorthand `data` read the *enclosing* `update({ where, data })` and
 *     reported `Model.where` and `Model.data` as unknown columns.
 *
 * Both were live bugs: the second is why this script exited 1 on a clean tree
 * for weeks, which is how it came to not be run by CI at all.
 */

const SCRIPT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../scripts/check-prisma-writes.mjs',
);

const SCHEMA = `model Widget {
  id    String @id
  name  String
  count Int     @default(0)
}
`;

interface Run {
  status: number;
  out: string;
}

/** Writes a fixture tree and runs the checker against it. */
function run(src: string): Run {
  const root = mkdtempSync(join(tmpdir(), 'prisma-writes-'));
  try {
    mkdirSync(join(root, 'prisma'), { recursive: true });
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'prisma', 'schema.prisma'), SCHEMA);
    writeFileSync(join(root, 'src', 'widget.service.ts'), src);

    const res = spawnSync(
      process.execPath,
      [SCRIPT, `--src=${join(root, 'src')}`, `--schema=${join(root, 'prisma', 'schema.prisma')}`],
      { encoding: 'utf8' },
    );
    return { status: res.status ?? -1, out: `${res.stdout}${res.stderr}` };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('check-prisma-writes', () => {
  it('passes a tree with only declared fields', () => {
    const { status, out } = run(`
export function save(prisma: any) {
  return prisma.widget.update({ where: { id: 'w' }, data: { name: 'n' } });
}
`);
    expect(out).not.toContain('UNKNOWN FIELD');
    expect(status).toBe(0);
  });

  it('fails on a field the model does not declare', () => {
    const { status, out } = run(`
export function save(prisma: any) {
  return prisma.widget.update({ where: { id: 'w' }, data: { namee: 'n' } });
}
`);
    expect(status).toBe(1);
    expect(out).toContain('UNKNOWN FIELD');
    expect(out).toContain('Widget.namee');
  });

  it('never reports the `where` argument as a written field', () => {
    // The script's own contract says it deliberately does not look at `where`.
    // Reporting it meant reading the arguments as if they were the columns.
    const { out } = run(`
export function save(prisma: any, data: object) {
  return prisma.widget.update({ where: { id: 'w' }, data });
}
`);
    expect(out).not.toContain('Widget.where');
    expect(out).not.toContain('Widget.data');
  });

  it('reads shorthand `data` through a comment — the swallowed-property bug', () => {
    // Whitespace at depth 1 used to clear `expectKey`, so this property was
    // consumed a character at a time until the next comma and never checked.
    // This is the case that produced a silent pass.
    const { status, out } = run(`
export function save(prisma: any, now: Date) {
  const data: Record<string, unknown> = {
    // Moved on every sweep. A comment is what used to lose the next property.
    bogusColumnForTest: now,
    name: 'n',
  };
  return prisma.widget.update({ where: { id: 'w' }, data });
}
`);
    expect(status).toBe(1);
    expect(out).toContain('Widget.bogusColumnForTest');
  });

  it('checks a shorthand that resolves to a valid literal', () => {
    const { status, out } = run(`
export function save(prisma: any, now: Date) {
  const data: Record<string, unknown> = {
    // a comment, with a valid property after it
    name: 'n',
    count: 1,
  };
  return prisma.widget.update({ where: { id: 'w' }, data });
}
`);
    expect(out).not.toContain('UNKNOWN FIELD');
    expect(status).toBe(0);
  });

  it('reports a shorthand it cannot resolve rather than passing it', () => {
    const { status, out } = run(`
export function save(prisma: any) {
  return prisma.widget.update({ where: { id: 'w' }, data: buildPatch() });
}
`);
    expect(status).toBe(0); // not a definite error
    expect(out).toContain('UNVERIFIABLE'); // but not a silent pass either
  });

  it('exits 2 with a readable message when the path does not exist', () => {
    const res = spawnSync(process.execPath, [SCRIPT, '--src=/definitely/not/here'], {
      encoding: 'utf8',
    });
    expect(res.status).toBe(2);
    expect(`${res.stdout}${res.stderr}`).toContain('source tree not found');
  });
});
