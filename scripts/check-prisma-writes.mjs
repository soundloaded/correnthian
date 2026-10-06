#!/usr/bin/env node
/**
 * Catch a field name in a Prisma write that no model declares.
 *
 * `RedemptionService.transition` wrote `reviewedBy` to `RedemptionRequest`,
 * which has no such column. Prisma rejects that at runtime as a
 * `PrismaClientValidationError`, which the exception filter maps to a 500 — so
 * an operator approving a physical gold redemption got "Internal server error"
 * and the approval never happened. Nothing static noticed.
 *
 * WHY TSC CANNOT SEE IT
 * ---------------------
 * Prisma types `update`'s `data` as `Prisma.XOR<UpdateInput, UncheckedUpdateInput>`.
 * A union defeats TypeScript's excess-property check, so *any* key is accepted
 * there — not just `reviewedBy`, every key in every `update`, `updateMany` and
 * the `update` half of an `upsert`. `create` is not affected: its input
 * resolves to a concrete intersection, and a typo in a `create` is a TS2561
 * (verified — `ammountRaw` in a `create` fails to compile).
 *
 * So the compiler covers part of the write surface and nothing covered the
 * rest. This script is what covers it.
 *
 * WHAT IT VERIFIES, AND WHAT IT ADMITS IT CANNOT
 * ---------------------------------------------
 * The schema is the source of truth. Every top-level field key written into a
 * `data` / `create` / `update` argument must be declared on the model.
 *
 * It checks these shapes, and says so in the output:
 *
 *   - an object literal: `data: { state: 'x' }`
 *   - an array of object literals: `createMany({ data: [{...}, {...}] })`
 *   - a conditional spread, which is how optional fields are written:
 *     `data: { state, ...(cond ? { reviewedBy: id } : {}) }`. The keys of each
 *     branch literal are checked. This is the shape of the original defect.
 *   - a logical spread: `...(proofUrl && { proofOfReserveUrl: proofUrl })`
 *   - a spread of a same-file `const` object literal
 *
 * It does **not** check these, and reports each one as `UNVERIFIABLE` rather
 * than passing it silently:
 *
 *   - `...dto`, `...payload` and any spread of an identifier or call whose
 *     value is not a same-file object literal. Without a type checker the
 *     written keys are not knowable, and guessing would be worse than saying
 *     so. (Running `tsc` would resolve many of them; this script deliberately
 *     does not, so that it stays a five-second check that needs no build.)
 *   - `data: someVariable`, `data: buildPatch()` — the argument is not a
 *     literal.
 *   - a computed key: `{ [field]: value }`
 *   - any operand of a spread that is not itself an object literal, e.g.
 *     `...(cond ? { a: 1 } : fallback)` — the `fallback` side is unknown.
 *
 * And it deliberately does not look at `where`. Unique selectors such as
 * `walletId_assetId: { ... }` are a different shape with a different risk
 * profile; folding them in would make this report about two things at once.
 *
 * Nested relation writes (`data: { asset: { connect: {...} } }`) are counted
 * and skipped: the relation key is valid on the model, and the nested argument
 * is a different input type.
 *
 * USAGE
 * -----
 *   node scripts/check-prisma-writes.mjs           # exit 1 on an unknown field
 *   node scripts/check-prisma-writes.mjs --strict  # also exit 1 on anything
 *                                                  # unverifiable
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA = join(ROOT, 'services/api/prisma/schema.prisma');
const SRC = join(ROOT, 'services/api/src');
const STRICT = process.argv.includes('--strict');

/**
 * `data` on create/update/updateMany; `create` and `update` on upsert. An
 * upsert's `create` is a full row, so it is checked exactly like a `create`.
 */
const DATA_KEYS = new Set(['data', 'create', 'update']);
const WRITE_OPS = ['create', 'createMany', 'update', 'updateMany', 'upsert'];
const WRITE_OP_RE = new RegExp(`\\bprisma\\.(\\w+)\\.(${WRITE_OPS.join('|')})\\s*\\(`, 'g');

// ---------------------------------------------------------------------------
// The schema
// ---------------------------------------------------------------------------

/**
 * Two passes, because a relation field's target may be declared after the
 * model that references it. Pass one collects every declared field name; pass
 * two marks the ones whose type names another model as relations.
 */
function parseModels(schema) {
  const raw = new Map();
  for (const m of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const fields = new Map();
    for (const line of m[2].split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('//') || t.startsWith('@@')) continue;
      const fm = t.match(/^(\w+)\s+([A-Za-z_]\w*)/);
      if (fm) fields.set(fm[1], fm[2]);
    }
    raw.set(m[1], fields);
  }

  const models = new Map();
  for (const [name, fields] of raw) {
    const relations = new Set();
    for (const [field, type] of fields) if (raw.has(type)) relations.add(field);
    models.set(name, { fields, relations });
  }
  return models;
}

/** `redemptionRequest` -> `RedemptionRequest`, the Prisma accessor convention. */
function modelForAccessor(models, accessor) {
  const guess = accessor.charAt(0).toUpperCase() + accessor.slice(1);
  if (models.has(guess)) return guess;
  // Acronyms and irregular names: fall back to a case-insensitive match so a
  // renamed model is reported as unknown rather than silently unchecked.
  for (const name of models.keys()) {
    if (name.toLowerCase() === accessor.toLowerCase()) return name;
  }
  return null;
}

// ---------------------------------------------------------------------------
// A small source reader
// ---------------------------------------------------------------------------

function skipString(src, i) {
  const quote = src[i];
  let j = i + 1;
  while (j < src.length) {
    if (src[j] === '\\') { j += 2; continue; }
    if (src[j] === quote) return j + 1;
    if (quote === '`' && src[j] === '$' && src[j + 1] === '{') {
      // A template interpolation can hold anything, including braces. Skip to
      // its close rather than letting it unbalance the depth count.
      let depth = 1;
      let k = j + 2;
      while (k < src.length && depth > 0) {
        if (src[k] === '{') depth += 1;
        else if (src[k] === '}') depth -= 1;
        else if (src[k] === '"' || src[k] === "'" || src[k] === '`') k = skipString(src, k) - 1;
        k += 1;
      }
      j = k;
      continue;
    }
    j += 1;
  }
  return src.length;
}

function skipComment(src, i) {
  if (src[i + 1] === '/') {
    const nl = src.indexOf('\n', i);
    return nl < 0 ? src.length : nl;
  }
  const end = src.indexOf('*/', i + 2);
  return end < 0 ? src.length : end + 2;
}

/** Skip whitespace and comments; return the index of the next real token. */
function skipTrivia(src, i) {
  let j = i;
  while (j < src.length) {
    const c = src[j];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { j += 1; continue; }
    if (c === '/' && (src[j + 1] === '/' || src[j + 1] === '*')) {
      j = skipComment(src, j);
      continue;
    }
    return j;
  }
  return j;
}

/**
 * Read the object literal at `src[i] === '{'`.
 *
 * Top-level properties (`valueStart: -1` for shorthand, where the key is its
 * own value) plus every `...spread` at that level. Depth is tracked so a
 * nested object in a value cannot be mistaken for a property of the outer one.
 */
function readObjectLiteral(src, i) {
  const props = [];
  const spreads = [];
  let depth = 0;
  let expectKey = true;
  let j = i;

  while (j < src.length) {
    const c = src[j];

    if (c === '"' || c === "'" || c === '`') { j = skipString(src, j); continue; }
    if (c === '/' && (src[j + 1] === '/' || src[j + 1] === '*')) {
      j = skipComment(src, j);
      continue;
    }

    if (c === '{' || c === '[' || c === '(') {
      depth += 1;
      if (c === '{' && depth === 1) expectKey = true;
      j += 1;
      continue;
    }
    if (c === '}' || c === ']' || c === ')') {
      depth -= 1;
      j += 1;
      if (c === '}' && depth === 0) return { props, spreads, end: j };
      continue;
    }

    if (depth === 1 && expectKey) {
      const rest = src.slice(j);

      const spread = rest.match(/^\s*\.\.\./);
      if (spread) {
        spreads.push({ at: j + spread[0].length - 3, exprStart: j + spread[0].length });
        expectKey = false;
        j += spread[0].length;
        continue;
      }

      // A computed key is not statically knowable. Record it so the caller can
      // say so rather than quietly treating the object as checked.
      if (rest.match(/^\s*\[/)) {
        props.push({ key: null, valueStart: -1, computed: true });
        expectKey = false;
        j += 1;
        continue;
      }

      const named = rest.match(/^\s*([A-Za-z_$][\w$]*)\s*:/);
      if (named) {
        props.push({ key: named[1], valueStart: j + named[0].length, computed: false });
        expectKey = false;
        j += named[0].length;
        continue;
      }

      const short = rest.match(/^\s*([A-Za-z_$][\w$]*)\s*(?=[,}])/);
      if (short) {
        props.push({ key: short[1], valueStart: -1, computed: false });
        expectKey = false;
        j += short[0].length;
        continue;
      }

      expectKey = false;
      j += 1;
      continue;
    }

    if (depth === 1 && c === ',') expectKey = true;
    j += 1;
  }
  return { props, spreads, end: j };
}

/** End of the expression starting at `i`: the next depth-0 `,` or `}`. */
function expressionEnd(src, i) {
  let depth = 0;
  let j = i;
  while (j < src.length) {
    const c = src[j];
    if (c === '"' || c === "'" || c === '`') { j = skipString(src, j); continue; }
    if (c === '/' && (src[j + 1] === '/' || src[j + 1] === '*')) {
      j = skipComment(src, j);
      continue;
    }
    if (c === '{' || c === '[' || c === '(') { depth += 1; j += 1; continue; }
    if (c === '}' || c === ']' || c === ')') {
      if (depth === 0) return j;
      depth -= 1;
      j += 1;
      continue;
    }
    if (depth === 0 && (c === ',' || c === ';')) return j;
    j += 1;
  }
  return src.length;
}

/**
 * The bounds of `expr` with any wrapping parentheses removed.
 *
 * `...(cond ? { a: 1 } : {})` is nearly always written with the parentheses,
 * and they must not count as nesting — the whole point of the ternary is that
 * its branches sit at the top level of the spread. Offsets stay absolute into
 * `expr` so callers can index the original source.
 */
function unwrapParens(expr) {
  let start = 0;
  let end = expr.length;
  const trim = () => {
    while (start < end && /\s/.test(expr[start])) start += 1;
    while (end > start && /\s/.test(expr[end - 1])) end -= 1;
  };
  trim();

  while (end - start >= 2 && expr[start] === '(' && expr[end - 1] === ')') {
    let depth = 0;
    let wraps = true;
    for (let i = start; i < end; i += 1) {
      const c = expr[i];
      if (c === '"' || c === "'" || c === '`') { i = skipString(expr, i) - 1; continue; }
      if (c === '(') depth += 1;
      else if (c === ')') {
        depth -= 1;
        if (depth === 0 && i < end - 1) { wraps = false; break; }
      }
    }
    if (!wraps) break;
    start += 1;
    end -= 1;
    trim();
  }
  return { start, end };
}

/**
 * Split a spread's expression into the operands that contribute keys.
 *
 * In `cond ? { a: 1 } : fallback`, only the branches after `?` and `:` are
 * spread into the target — the condition is not. Operands therefore begin
 * after a depth-0 `?`, `:`, `&&`, `||` or `??`; everything before the first
 * operator is context and is not treated as a written value.
 */
function spreadOperands(expr) {
  const { start: lo, end: hi } = unwrapParens(expr);
  const operands = [];
  let depth = 0;
  let start = null;

  const flush = (end) => {
    if (start === null) return;
    const from = Math.max(start, lo);
    const to = Math.min(end, hi);
    const text = to > from ? expr.slice(from, to).trim() : '';
    if (text) operands.push({ text, start: from, end: to });
    start = null;
  };

  for (let j = lo; j < hi; j += 1) {
    const c = expr[j];
    if (c === '"' || c === "'" || c === '`') { j = skipString(expr, j) - 1; continue; }
    if (c === '{' || c === '[' || c === '(') { depth += 1; continue; }
    if (c === '}' || c === ']' || c === ')') { depth -= 1; continue; }
    if (depth !== 0) continue;

    const two = expr.slice(j, j + 2);
    const isLogical = two === '&&' || two === '||' || two === '??';
    // `?.` is an optional-chaining question mark, not a ternary.
    const isTernary = (c === '?' && expr[j + 1] !== '.') || c === ':';
    if (!isLogical && !isTernary) continue;

    flush(j);
    const opLen = isLogical ? 2 : 1;
    j += opLen - 1;
    start = skipTrivia(expr, j + 1);
    j = start - 1;
  }
  flush(hi);

  // No operator at all: the expression is one operand, such as `...{ a: 1 }`
  // or `...patch`.
  if (operands.length === 0) {
    const text = expr.slice(lo, hi).trim();
    if (text) operands.push({ text, start: lo, end: hi });
  }
  return operands;
}

/** `const patch = { ... }` in the same file, for a spread of a local binding. */
function findConstObjectLiteral(src, name) {
  const re = new RegExp(`\\b(?:const|let|var)\\s+${name}\\s*(?::[^=]+)?=\\s*`, 'g');
  for (const m of src.matchAll(re)) {
    const at = skipTrivia(src, m.index + m[0].length);
    if (src[at] !== '{') continue;
    return at;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// The check
// ---------------------------------------------------------------------------

function collectTsFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'generated' || entry === 'node_modules') continue;
      collectTsFiles(full, out);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

function check() {
  const models = parseModels(readFileSync(SCHEMA, 'utf-8'));
  const files = collectTsFiles(SRC);

  /** A definite error: a field the model does not declare. */
  const offences = [];
  /** A shape this script cannot decide, listed so it is never mistaken for a pass. */
  const unverifiable = [];
  /** A nested relation write, skipped by design and counted so the gap is visible. */
  const nested = [];

  let calls = 0;
  let checkedKeys = 0;

  const where = (file, at, src) => `${relative(ROOT, file)}:${src.slice(0, at).split('\n').length}`;

  /** Check one field key of one write against its model. */
  const checkKey = (file, src, at, modelName, model, key) => {
    checkedKeys += 1;
    if (model.fields.has(key)) return;
    if (model.relations.has(key)) {
      nested.push({ where: where(file, at, src), model: modelName, key });
      return;
    }
    offences.push({ where: where(file, at, src), model: modelName, key });
  };

  /** Check one object literal that is being spread or assigned into a write. */
  const checkLiteral = (file, src, at, modelName, model) => {
    const literal = readObjectLiteral(src, at);
    for (const p of literal.props) {
      if (p.computed) {
        unverifiable.push({
          where: where(file, at, src),
          model: modelName,
          why: `computed key ${src.slice(at, p.valueStart < 0 ? at + 1 : p.valueStart).trim().slice(0, 40)}`,
        });
        continue;
      }
      checkKey(file, src, at, modelName, model, p.key);
    }

    for (const spread of literal.spreads) {
      const end = expressionEnd(src, spread.exprStart);
      const expr = src.slice(spread.exprStart, end);

      for (const op of spreadOperands(expr)) {
        const at = skipTrivia(src, spread.exprStart + op.start);
        if (src[at] === '{') {
          checkLiteral(file, src, at, modelName, model);
          continue;
        }
        // `...patch`, where `patch` is an object literal a few lines up. Worth
        // resolving — it is common, and it is still a literal this script can
        // read. Anything else is honestly unknown.
        const ident = op.text.match(/^([A-Za-z_$][\w$]*)$/);
        const constAt = ident ? findConstObjectLiteral(src, ident[1]) : -1;
        if (constAt >= 0) {
          checkLiteral(file, src, constAt, modelName, model);
          continue;
        }
        unverifiable.push({
          where: where(file, spread.at, src),
          model: modelName,
          why: `spread of \`${op.text.slice(0, 60)}\` — written keys are not knowable without a type checker`,
        });
      }
    }
  };

  for (const file of files) {
    const src = readFileSync(file, 'utf-8');
    WRITE_OP_RE.lastIndex = 0;

    for (const m of src.matchAll(WRITE_OP_RE)) {
      calls += 1;
      const modelName = modelForAccessor(models, m[1]);
      if (!modelName) {
        // An accessor with no model behind it is a renamed model, which is
        // exactly how a check like this rots into a no-op. Reported, not
        // skipped.
        unverifiable.push({
          where: where(file, m.index, src),
          model: m[1],
          why: `no model named ${m[1]} in schema.prisma — cannot decide what it accepts`,
        });
        continue;
      }
      const model = models.get(modelName);

      const argStart = skipTrivia(src, m.index + m[0].length);
      if (src[argStart] !== '{') {
        unverifiable.push({
          where: where(file, m.index, src),
          model: modelName,
          why: `${m[2]}() argument is not an object literal`,
        });
        continue;
      }

      const arg = readObjectLiteral(src, argStart);
      for (const prop of arg.props) {
        if (prop.computed) continue;
        if (!DATA_KEYS.has(prop.key)) continue;

        const at = prop.valueStart < 0 ? argStart : skipTrivia(src, prop.valueStart);

        if (src[at] === '{') {
          checkLiteral(file, src, at, modelName, model);
        } else if (src[at] === '[') {
          // `createMany({ data: [{ ... }, { ... }] })` — every element is a row.
          const end = expressionEnd(src, at);
          const inner = src.slice(at, end);
          let found = 0;
          for (const open of inner.matchAll(/\{/g)) {
            const litAt = at + open.index;
            // Only the row literals sit at depth 1 of the array. Anything
            // deeper is a value inside a row.
            let depth = 0;
            for (let k = at; k < litAt; k += 1) {
              if (inner[k - at] === '[') depth += 1;
              else if (inner[k - at] === ']') depth -= 1;
            }
            if (depth !== 1) continue;
            found += 1;
            checkLiteral(file, src, litAt, modelName, model);
          }
          if (found === 0) {
            unverifiable.push({
              where: where(file, at, src),
              model: modelName,
              why: `${prop.key}: [...] with no readable row literal`,
            });
          }
        } else {
          // `data: patch`, where `patch` is a literal a few lines up.
          const text = src.slice(at, expressionEnd(src, at)).trim();
          const ident = text.match(/^([A-Za-z_$][\w$]*)$/);
          const constAt = ident ? findConstObjectLiteral(src, ident[1]) : -1;
          if (constAt >= 0) {
            checkLiteral(file, src, constAt, modelName, model);
          } else {
            unverifiable.push({
              where: where(file, at, src),
              model: modelName,
              why: `${prop.key}: is \`${text.slice(0, 60)}\`, not an object literal`,
            });
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Report
  // ---------------------------------------------------------------------------

  console.log('');
  if (offences.length > 0) {
    console.error('  UNKNOWN FIELD IN A PRISMA WRITE\n');
    for (const o of offences) console.error(`  ${o.where}  ${o.model}.${o.key}`);
    console.error(
      `\n  ${offences.length} field(s) are not declared on their model. Prisma rejects\n` +
        `  them at runtime as PrismaClientValidationError, which the exception filter\n` +
        `  maps to a 500 — and tsc cannot see them, because Prisma types update data\n` +
        `  as an XOR union that defeats the excess-property check.\n\n` +
        `  Fix: correct the field name, or add the column with a migration.\n`,
    );
    process.exit(1);
  }

  console.log(`  prisma writes — every field key checked against schema.prisma`);
  console.log(`    write call sites:              ${calls}`);
  console.log(`    field keys checked:            ${checkedKeys}`);
  console.log(`    nested relation writes:        ${nested.length}  (skipped by design)`);
  console.log(`    unverifiable write shapes:     ${unverifiable.length}`);

  if (unverifiable.length > 0) {
    console.log(`\n  UNVERIFIABLE — reported, not passed`);
    console.log(`  These writes could not be checked statically. They are not failures and`);
    console.log(`  not passes: the field names they write are unknown to this script.\n`);
    for (const u of unverifiable) console.log(`    ${u.where}  [${u.model}]  ${u.why}`);
    console.log(
      `\n  ${unverifiable.length} of ${calls} write call sites (${Math.round((unverifiable.length / Math.max(calls, 1)) * 100)}%) carry a shape this script\n` +
        `  cannot read. Read those by hand, or rewrite the write as a literal so it can\n` +
        `  be checked. Run with --strict to make them fail the build.\n`,
    );
    if (STRICT) {
      console.error('  --strict: failing because unverifiable write shapes remain.\n');
      process.exit(1);
    }
  } else {
    console.log(`\n  Every write was statically checkable.\n`);
  }
}

check();
