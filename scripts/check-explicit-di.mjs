#!/usr/bin/env node
/**
 * Catch implicit Nest DI before it reaches a runtime that cannot support it.
 *
 * Nest resolves a constructor parameter from its emitted `design:paramtypes`
 * metadata. tsc emits that metadata; esbuild does not. So a service injected
 * by parameter type alone works in the compiled build and fails everywhere
 * else — vitest, tsx, any bundler — with the dependency silently `undefined`.
 *
 * This has shipped broken three times in this repository, including in Nest's
 * own scaffold, and each time it was found by a test failing for an unrelated
 * looking reason. Reviewing for it does not work. Checking does.
 *
 * A parameter is fine when it carries an explicit @Inject(...), or is
 * decorated otherwise, or is a primitive type that Nest could never resolve
 * from metadata anyway.
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const files = execSync(
  "find services/api/src -name '*.ts' -not -name '*.spec.ts' -not -path '*/generated/*'",
  { encoding: 'utf-8' },
).trim().split('\n').filter(Boolean);

/**
 * Only classes the container actually constructs can suffer this. A class
 * marked @Injectable but instantiated by hand — ZodValidationPipe comes from
 * zodPipe() — takes whatever it is handed and has no metadata to lose.
 *
 * Narrowing to real registrations matters: a check that reports false
 * positives gets switched off, and then it catches nothing.
 */
const CONTAINER_REGISTERED = (() => {
  const names = new Set();
  for (const file of files) {
    const src = readFileSync(file, 'utf-8');
    for (const arrayName of ['providers', 'controllers', 'imports', 'exports']) {
      const block = src.match(new RegExp(`${arrayName}\\s*:\\s*\\[([\\s\\S]*?)\\]`));
      if (!block) continue;
      for (const ident of block[1].match(/[A-Z][A-Za-z0-9_]*/g) ?? []) names.add(ident);
    }
  }
  return names;
})();

// Nest resolves these from metadata, so they must never rely on it.
const PRIMITIVE = /^(string|number|boolean|any|unknown|object)$/;

const offences = [];

for (const file of files) {
  const src = readFileSync(file, 'utf-8');
  // Only providers, controllers, guards and interceptors are constructed by
  // the container. Plain classes take whatever they are handed.
  // Registration is the signal, not the decorator. A class can be listed in a
  // module's providers without @Injectable() and still be constructed by the
  // container — requiring the decorator left exactly that hole.
  const className = src.match(/(?:export\s+)?class\s+([A-Z][A-Za-z0-9_]*)/)?.[1];
  if (!className || !CONTAINER_REGISTERED.has(className)) continue;

  const ctor = src.match(/constructor\s*\(([\s\S]*?)\)\s*\{/);
  if (!ctor) continue;

  // Split on commas that are not inside a generic or a nested paren.
  const params = ctor[1].split(/,(?![^<(]*[>)]\s*(?:,|$))/);

  for (const raw of params) {
    const param = raw.trim();
    if (!param) continue;
    // A trailing `)` can be captured when decorators are parenthesised.
    if (/^\)/.test(param)) continue;
    if (param.startsWith('@') || param.includes('@Inject(')) continue;

    // `private readonly foo: Bar` — take the type after the colon.
    const m = param.match(/:\s*([A-Za-z0-9_$.<>[\]| ]+?)\s*$/);
    if (!m) continue;
    const type = m[1].trim().split(/[<|]/)[0].trim();
    if (!type || PRIMITIVE.test(type)) continue;
    // Index signatures and rest params are not DI targets.
    if (param.startsWith('...')) continue;

    const line = src.slice(0, src.indexOf(param)).split('\n').length;
    offences.push(`${file}:${line}  ${type}`);
  }
}

if (offences.length) {
  console.error('\n  IMPLICIT NEST DI\n');
  for (const o of offences) console.error(`  ${o}`);
  console.error(
    `\n  ${offences.length} constructor parameter(s) would resolve from emitted` +
      `\n  metadata. That works under tsc and silently yields undefined under` +
      `\n  esbuild, vitest and tsx.\n\n  Fix: add @Inject(Type) to each parameter.\n`,
  );
  process.exit(1);
}

console.log(`  explicit DI OK — ${files.length} files checked, no implicit injection`);
