import { z } from 'zod';
import { SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';
import { CONTRACT_REGISTRY } from '@correnthian/contracts';

/**
 * Put the contract registry into the document Swagger serves.
 *
 * `@nestjs/swagger` builds its document from route metadata: `@ApiTags`,
 * `@ApiOperation`, decorated DTOs. Correnthian validates with Zod instead, so
 * none of that metadata exists — and the generated document was a list of paths
 * with summaries and **no request or response schema anywhere** (BE-102).
 *
 * The response schemas already exist. `CONTRACT_REGISTRY` maps every contracted
 * endpoint to the exact Zod schema `contracts.spec.ts` parses real responses
 * with, so wiring them in means `/docs` and the contract suite can no longer
 * disagree: they read the same object.
 *
 * Two corrections happen on the way through:
 *
 * 1. **Paths gain their `/api/v1` prefix.** Swagger reads the controller's
 *    registered path, which has no prefix — the version middleware adds it at
 *    request time. So the document was describing the *legacy unversioned
 *    alias* as if it were the route, and that alias is removed on 2026-12-01.
 *    The prefixed copy is added as canonical and the original is marked
 *    `deprecated`, which is what it is.
 *
 * 2. **`:id` becomes `{id}`.** The registry uses Express-style params; OpenAPI
 *    uses braces. Matching without this silently skips every parameterised
 *    route.
 *
 * `ERROR …` keys are not routes and are skipped: they describe the shared
 * failure envelope, and mapping one of them to a status code would be a guess.
 */

type Operation = Record<string, any>;
type Paths = Record<string, Record<string, Operation>>;

export interface ApplyResult {
  /** Schemas attached to an operation. */
  applied: number;
  /** Canonical paths added. */
  canonicalised: number;
  /** Registry entries with no matching operation — a contract for a route the document does not know. */
  unmatched: string[];
}

/** Registry keys look like `GET /api/v1/users/:id`. `ERROR …` is not a route. */
const ROUTE_RE = /^(GET|POST|PATCH|PUT|DELETE) (.+)$/;
const VERSION_PREFIX = '/api/v1';

/** Paths served outside every version, per `/api/v1/meta/versions`. */
const UNVERSIONED = new Set(['health', 'docs', 'docs-json']);

function toDocumentPath(full: string): string {
  const unprefixed = full.startsWith(VERSION_PREFIX)
    ? full.slice(VERSION_PREFIX.length) || '/'
    : full;
  return unprefixed.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function isSuccessStatus(code: string): boolean {
  const n = Number(code);
  return n >= 200 && n < 300;
}

export function applyContractSchemas(document: OpenAPIObject): ApplyResult {
  if (!document.paths) document.paths = {};
  // Swagger's `PathItemObject` is a closed interface with no index signature,
  // so it does not satisfy a mapped type. The cast is deliberate and bounded:
  // every value under a path is either an operation or a `$ref`, and both
  // accept the fields written here.
  const paths = document.paths as unknown as Paths;
  const applied: string[] = [];
  const unmatched: string[] = [];
  let canonicalised = 0;

  // 1. Canonical, versioned copies of every path the middleware will actually
  //    route, with the original marked deprecated rather than deleted — it
  //    still works until the sunset, and a client reading this document should
  //    be told as much.
  const legacy = Object.keys(paths);
  for (const path of legacy) {
    if (path.startsWith(VERSION_PREFIX)) continue;
    if (UNVERSIONED.has(path.split('/')[1] ?? '')) continue;

    const source = paths[path];
    if (!source) continue;

    const canonical = `${VERSION_PREFIX}${path}`;
    if (!paths[canonical]) {
      // Shallow: the operations are copied, the nested `responses` object is
      // not, so a schema applied to one path reaches both forms without
      // duplicating it — they are the same handler answering either way.
      const copy: Record<string, Operation> = {};
      for (const [m, op] of Object.entries(source)) copy[m] = { ...op };
      paths[canonical] = copy;
      canonicalised += 1;
    }

    for (const op of Object.values(source)) {
      if (!op || typeof op !== 'object') continue;
      op.deprecated = true;
      const note =
        '**Legacy unversioned alias.** Served until 2026-12-01 and removed ' +
        `afterwards — use \`${canonical}${''}\`.`;
      op.description = op.description ? `${op.description}\n\n${note}` : note;
    }
  }

  // 2. Response schemas from the registry the contract suite enforces.
  for (const [key, schema] of Object.entries(CONTRACT_REGISTRY)) {
    const match = ROUTE_RE.exec(key);
    if (!match) continue;
    const method = match[1]!.toLowerCase();
    const docPath = toDocumentPath(match[2]!);
    const jsonSchema = z.toJSONSchema(schema, { io: 'output' });

    // Both forms carry the same handler and therefore the same response.
    for (const candidate of [docPath, `${VERSION_PREFIX}${docPath}`]) {
      const op = paths[candidate]?.[method];
      if (!op) continue;

      const responses = (op.responses ??= {});
      const success = Object.keys(responses).find(isSuccessStatus) ?? '200';
      let existing = responses[success];
      if (!existing) {
        existing = {};
        responses[success] = existing;
      }
      existing.description = existing.description ?? 'Success';
      existing.content = {
        ...existing.content,
        'application/json': { schema: jsonSchema },
      };
      applied.push(`${key} -> ${candidate}`);
    }

    if (!paths[docPath] && !paths[`${VERSION_PREFIX}${docPath}`]) {
      unmatched.push(key);
    }
  }

  return { applied: applied.length, canonicalised, unmatched };
}

/**
 * Build the document `/docs` serves.
 *
 * The boot path and the test call this same function, so a test that passes
 * says the served document is correct — asserting against a second copy of the
 * wiring is how a green test and a broken endpoint can coexist.
 */
export function createContractDocument(
  app: INestApplication,
  config: Omit<OpenAPIObject, 'paths'>,
): { document: OpenAPIObject; applied: ApplyResult } {
  const document = SwaggerModule.createDocument(app, config) as OpenAPIObject;
  return { document, applied: applyContractSchemas(document) };
}
