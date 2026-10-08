import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import { DocumentBuilder } from '@nestjs/swagger';
import { z } from 'zod';
import { beforeAll, describe, expect, it } from 'vitest';
import { CONTRACT_REGISTRY } from '@correnthian/contracts';
import type { OpenAPIObject } from '@nestjs/swagger';
import { applyContractSchemas, createContractDocument } from '../src/versioning/apply-contracts.js';
import { AppModule } from '../src/app.module.js';

/**
 * BE-102 — the document `/docs` serves.
 *
 * Swagger builds from route metadata; every Correnthian route validates with a
 * Zod schema instead, so there was no metadata to build from. The document was
 * 78 paths with summaries, **zero response schemas**, zero component schemas,
 * and every path missing its `/api/v1` prefix — it described the legacy
 * unversioned alias, which is removed on 2026-12-01.
 *
 * The fix reads `CONTRACT_REGISTRY`, which is the same object
 * `contracts.spec.ts` parses real responses with. These tests assert that, so
 * `/docs` and the contract suite cannot drift apart silently.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const CI = Boolean(process.env.CI);

const ROUTE_RE = /^(GET|POST|PATCH|PUT|DELETE) (.+)$/;

/**
 * Swagger's `PathItemObject` is a closed interface with no index signature, so
 * it cannot be indexed by a computed string. The document is walked as loose
 * maps here for the same reason `applyContractSchemas` does: every value under
 * a path is an operation or a `$ref`, and only the operation's shape matters.
 */
type LooseOperation = Record<string, any>;
const pathsOf = (doc: OpenAPIObject): Record<string, Record<string, LooseOperation>> =>
  (doc.paths ?? {}) as unknown as Record<string, Record<string, LooseOperation>>;
const registryRoutes = Object.entries(CONTRACT_REGISTRY).filter(([k]) =>
  ROUTE_RE.test(k),
);

describe.skipIf(!HAS_DB && !CI)('OpenAPI document', () => {
  let document: OpenAPIObject;
  let applied: ReturnType<typeof applyContractSchemas>;

  beforeAll(async () => {
    const app = (
      await Test.createTestingModule({ imports: [AppModule] }).compile()
    ).createNestApplication();
    await app.init();

    const config = new DocumentBuilder()
      .setTitle('Correnthian API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();

    ({ document, applied } = createContractDocument(app, config));
    await app.close();
  }, 60_000);

  it('attaches a response schema for every contracted route', () => {
    const missing: string[] = [];

    for (const [key] of registryRoutes) {
      const m = ROUTE_RE.exec(key)!;
      const method = m[1]!.toLowerCase();
      const docPath = m[2]!.replace(/^\/api\/v1/, '').replace(/:([A-Za-z0-9_]+)/g, '{$1}');

      const op = pathsOf(document)[docPath]?.[method];
      const schemas = Object.values(op?.responses ?? {})
        .flatMap((r: any) => Object.values(r?.content ?? {}))
        .map((c: any) => c?.schema)
        .filter(Boolean);

      if (schemas.length === 0) missing.push(key);
    }

    expect(missing, `no response schema for:\n${missing.join('\n')}`).toEqual([]);
  });

  it('uses the schema the contract suite enforces, not a re-declaration', () => {
    // The whole point: if this were written by hand the two could drift, and
    // drift is the thing ADR-010 exists to prevent.
    const [, key] = registryRoutes.find(([k]) => k === 'GET /api/v1/chains') ?? [];
    expect(key).toBeTruthy();

    const doc = pathsOf(document)['/chains']?.get;
    const schema = doc?.responses?.['200']?.content?.['application/json']?.schema;
    const expected = z.toJSONSchema(CONTRACT_REGISTRY['GET /api/v1/chains'], {
      io: 'output',
    });

    expect(schema).toEqual(expected);
  });

  it('adds the versioned path as the canonical one', () => {
    const m = ROUTE_RE.exec('GET /api/v1/users/:id')!;
    expect(pathsOf(document)['/api/v1/users/{id}']?.get).toBeDefined();
    expect(pathsOf(document)['/users/{id}']?.get).toBeDefined();
    expect(m).toBeTruthy();
  });

  it('marks the unversioned form deprecated, because it is removed 2026-12-01', () => {
    // The document used to describe *only* this form, as if it were the route.
    expect(pathsOf(document)['/users/{id}']?.get?.deprecated).toBe(true);
    expect(pathsOf(document)['/api/v1/users/{id}']?.get?.deprecated).toBeUndefined();
    expect(String(pathsOf(document)['/users/{id}']?.get?.description)).toContain('2026-12-01');
  });

  it('leaves the unversioned paths unversioned', () => {
    // /health, /docs and /docs-json are unversioned by design: an
    // orchestrator's probe must not negotiate a version.
    expect(pathsOf(document)['/health/ready']).toBeDefined();
    expect(pathsOf(document)['/api/v1/health/ready']).toBeUndefined();
  });

  it('matches every contract to a route', () => {
    // A contract with no route behind it means the registry and the
    // controllers have diverged — the exact thing this wiring exists to catch.
    expect(applied.unmatched).toEqual([]);
    expect(applied.applied).toBeGreaterThan(30);
    expect(applied.canonicalised).toBeGreaterThan(50);
  });

  it('is built through the shared helper by the boot path', () => {
    // The tests above call `createContractDocument` directly, which says
    // nothing about whether `main.ts` still does. A document built the other
    // way would serve a different shape from the one asserted here, and no
    // other test would notice.
    const main = readFileSync(
      join(process.cwd(), 'src', 'main.ts'),
      'utf8',
    );

    expect(main).toContain('createContractDocument(');
    expect(main).not.toContain('SwaggerModule.createDocument(');
  });

  it('does not treat an ERROR key as a route', () => {
    // `ERROR POST /api/v1/...` describes the shared failure envelope.
    const errorKeys = Object.keys(CONTRACT_REGISTRY).filter((k) => k.startsWith('ERROR '));
    expect(errorKeys.length).toBeGreaterThan(0);
    expect(applied.unmatched).toEqual(expect.not.arrayContaining(errorKeys));
  });
});
