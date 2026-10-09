import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Route discovery, shared by the suites that read the controller files.
 *
 * There were three copies of this logic, written one per spec, and they had
 * already drifted: all of them capped the look-ahead for the handler's name at
 * 400 characters, and `jobs.controller.ts` put an `@ApiOperation` block longer
 * than that between its `@Get()` and `list()`. So `GET /jobs` was discovered
 * by nothing — invisible to the anonymous-401 guard over the whole route table
 * *and* to the roles gate over it, while the file's other route kept the
 * per-file "found at least one" check green. Eighty-seven route decorators
 * exist in the controllers; the specs were reading eighty-six.
 *
 * One discovery now serves every consumer, and finding the handler is a walk
 * over lines rather than a fixed-size slice: decorator lines and comment lines
 * are skipped, and the first line that opens a signature ends the search. No
 * amount of metadata above a handler can push it out of range.
 */

export interface DiscoveredRoute {
  file: string;
  method: string;
  path: string;
  isPublic: boolean;
  /** Effective roles: handler-level `@Roles` if present, else class-level. */
  roles: string[];
}

const CONTROLLERS = join(process.cwd(), 'src');

function rolesFrom(text: string): string[] {
  return [...text.matchAll(/@Roles\(([^)]*)\)/g)]
    .flatMap((m) => [...(m[1] ?? '').matchAll(/'([^']+)'|"([^"]+)"/g)].map((q) => q[1] ?? q[2]))
    .filter((r): r is string => Boolean(r));
}

/**
 * Where the handler's signature starts, measured inside `rest` — the text
 * following a route decorator.
 *
 * `@ApiApiOperation({\n  summary: ...\n})` spans lines that are neither
 * decorators nor signatures; they are skipped too, so the walk finds `list(`
 * wherever the author put it.
 */
function handlerStart(rest: string): number | null {
  let offset = 0;
  for (const line of rest.split('\n')) {
    const end = offset + line.length;
    const trimmed = line.trim();
    const isDecorated =
      trimmed.startsWith('@') ||
      trimmed === '' ||
      trimmed.startsWith('//') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('/*');
    if (!isDecorated) {
      // Anchored to the *trimmed* line: every handler line is indented, and
      // anchoring to the raw line found no signature in any controller —
      // which is how this module first reported zero routes.
      const sig = trimmed.match(/^(?:public |private |async )*(\w+)\s*\(/);
      if (sig) return offset + (line.length - trimmed.length) + sig[0].length;
    }
    offset = end + 1;
  }
  return null;
}

/**
 * Read every route out of every controller.
 *
 * Two windows around a route decorator:
 *
 *  - **before**, cut at the previous handler's closing brace, so another
 *    handler's decorators are not counted; `@Public()` written above the
 *    route decorator lives here.
 *  - **after**, ending at the handler's signature, so decorators written
 *    below the route decorator live there. The end is the *signature*, not an
 *    estimate — that estimate is what dropped `GET /jobs`.
 *
 * Class decorators are read once, up to `export class`: `@Roles` above or
 * below `@Controller()` binds either way, and handler metadata wins over it,
 * exactly as `Reflector.getAllAndOverride([handler, class])` resolves.
 */
export function discoverRoutes(): { routes: DiscoveredRoute[]; byFile: Map<string, number> } {
  const files = readdirSync(CONTROLLERS, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .flatMap((d) =>
      readdirSync(join(CONTROLLERS, d.name))
        .filter((f) => f.endsWith('.controller.ts'))
        .map((f) => join(CONTROLLERS, d.name, f)),
    )
    .sort();

  const routes: DiscoveredRoute[] = [];
  const byFile = new Map<string, number>();

  for (const file of files) {
    const src = readFileSync(file, 'utf-8');
    const rel = file.slice(CONTROLLERS.length + 1);
    const pm = src.match(/@Controller\(['"]([^'"]*)['"]\)/);
    const prefix = pm?.[1] ?? '';

    const classEnd = src.indexOf('export class', pm?.index ?? 0);
    const classRoles = rolesFrom(src.slice(0, classEnd === -1 ? src.length : classEnd));

    let found = 0;
    for (const m of src.matchAll(/@(Get|Post|Patch|Put|Delete)\(\s*['"]?([^'")]*)['"]?\s*\)/g)) {
      const method = m[1];
      if (!method) continue;
      const rest = src.slice(m.index + m[0].length);
      const sigStart = handlerStart(rest);
      if (sigStart === null) continue;

      const before = src.slice(Math.max(0, m.index - 500), m.index);
      const after = rest.slice(0, sigStart);
      const boundary = Math.max(before.lastIndexOf('}'), before.lastIndexOf('return '));
      const span = before.slice(boundary + 1) + after;

      const methodRoles = rolesFrom(span);
      const full = '/' + [
        prefix.replace(/^\/|\/$/g, ''),
        (m[2] ?? '').replace(/^\//g, ''),
      ].filter(Boolean).join('/');

      routes.push({
        file: rel,
        method,
        path: full,
        isPublic: /@Public\(\)/.test(span),
        roles: methodRoles.length ? methodRoles : classRoles,
      });
      found += 1;
    }
    byFile.set(rel, found);
  }
  return { routes, byFile };
}

/**
 * How many route decorators exist, counted without the discovery parser.
 *
 * A loose regex on purpose: `discoverRoutes` skips a route it cannot parse,
 * and a skip that shares its parser's assumptions would be invisible. This
 * counts any `@Get(`-shaped token, so a decorator form the parser does not
 * understand makes the two numbers disagree instead of quietly shrinking
 * coverage — which is exactly how `GET /jobs` stayed out of every suite.
 */
export function countRouteDecorators(): number {
  const files = readdirSync(CONTROLLERS, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .flatMap((d) =>
      readdirSync(join(CONTROLLERS, d.name))
        .filter((f) => f.endsWith('.controller.ts'))
        .map((f) => join(CONTROLLERS, d.name, f)),
    );
  let n = 0;
  for (const file of files) {
    n += readFileSync(file, 'utf-8').match(/@(Get|Post|Patch|Put|Delete)\(/g)?.length ?? 0;
  }
  return n;
}
