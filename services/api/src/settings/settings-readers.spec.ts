import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SETTING_DEFINITIONS } from './registry.js';

/**
 * Every setting must be read by code.
 *
 * A setting that nothing reads is a control that saves nowhere — the defect
 * this whole feature exists to remove, one layer up. A test is the only
 * thing that catches it: the console renders the setting perfectly well
 * either way, and the row looks live.
 *
 * The scan is over production code only. A spec that mentions a key is not a
 * reader, and counting the specs would make this test pass for free.
 */
const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, '..');

function productionSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'generated') continue;
      out.push(...productionSources(path));
      continue;
    }
    if (!entry.name.endsWith('.ts')) continue;
    if (entry.name.endsWith('.spec.ts')) continue;
    out.push(path);
  }
  return out;
}

const REGISTRY_FILE = join(here, 'registry.ts');
const SOURCES = productionSources(srcRoot).filter((path) => path !== REGISTRY_FILE);
const SOURCE_TEXT = SOURCES.map((path) => readFileSync(path, 'utf8')).join('\n');

describe('every setting has a reader', () => {
  it('a key is mentioned by code outside the registry', () => {
    const unread: string[] = [];

    for (const definition of SETTING_DEFINITIONS) {
      if (SOURCE_TEXT.includes(definition.key)) continue;
      // A key published to clients is read by the client config, which lives
      // beside the registry. That counts: the value reaches a user.
      if (
        definition.clientVisible &&
        readFileSync(join(here, 'client-config.controller.ts'), 'utf8').includes(definition.key)
      ) {
        continue;
      }
      unread.push(definition.key);
    }

    expect(
      unread,
      `these settings are declared but nothing reads them: ${unread.join(', ')}`,
    ).toEqual([]);
  });

  it('the scan actually found the source files', () => {
    // A scan that matched nothing would pass the test above for the wrong
    // reason, and the reason would be invisible.
    expect(SOURCES.length).toBeGreaterThan(20);
  });
});
