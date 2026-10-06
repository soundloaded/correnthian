import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { errorEnvelope, pathOnly } from '../common/errors.js';
import {
  API_PREFIX,
  API_VERSIONS,
  CURRENT_API_VERSION,
  findVersion,
  LEGACY_UNVERSIONED_ALIAS,
  UNVERSIONED_PATHS,
  versionIds,
  type ApiVersion,
} from './api-versions.js';

/**
 * Version negotiation and the transitional unversioned alias.
 *
 * Runs before routing, so a version we do not serve is answered here rather
 * than falling through to the router and emerging as a bare `404 Cannot GET
 * /api/v2/assets`. That distinction is the whole reason this file exists: a 404
 * for a version nobody has shipped and a 404 for an asset that genuinely does
 * not exist mean opposite things to whoever hit them. The first is "you are
 * talking to the wrong deployment", the second is "look at what does exist".
 * Collapsing them into one status code makes both undiagnosable without reading
 * server logs.
 *
 * The decision itself lives in `resolveVersionRoute`, which is pure and takes
 * the registry as an argument. That is not ceremony: `v1` is the only version
 * in the registry today, so the deprecated and retired branches below cannot be
 * reached by any request to this deployment — and an untested retirement path
 * is one that is discovered to be broken on the day a version actually retires,
 * which is the worst possible day to find out.
 */

const unversionedSet = new Set<string>(UNVERSIONED_PATHS);

/** What a version identifier looks like. `v1`, `v12`, and nothing else. */
const VERSION_SHAPE = /^v\d+$/;

/** Segments that are never rewritten onto the versioned prefix. */
function isReserved(segment: string): boolean {
  return segment.startsWith('.') || unversionedSet.has(segment);
}

function httpDate(iso: string): string {
  return new Date(iso).toUTCString();
}

export type VersionRoute =
  /** Serve it. `version` is routable. */
  | { kind: 'serve'; version: ApiVersion }
  /** `/api` — no version segment at all. */
  | { kind: 'missing-version' }
  /** `/api/assets` — a segment where a version should be, and not one. */
  | { kind: 'not-a-version'; requested: string }
  /** `/api/v2/assets` — well-formed, and not a version we have. */
  | { kind: 'unknown-version'; requested: string }
  /** Past its sunset date and no longer routed. */
  | { kind: 'retired'; version: ApiVersion };

/**
 * What to do with the version segment of an `/api/...` path.
 *
 * Pure, and takes the registry rather than reading the module constant, so the
 * lifecycle can be exercised without waiting for a real second version.
 */
export function resolveVersionRoute(
  requested: string | undefined,
  versions: readonly ApiVersion[] = API_VERSIONS,
): VersionRoute {
  if (!requested) return { kind: 'missing-version' };

  // `v2` is someone who used a version we do not have; `assets` is someone who
  // forgot the version entirely. Different mistakes, different fixes.
  if (!VERSION_SHAPE.test(requested)) return { kind: 'not-a-version', requested };

  const version = findVersion(requested, versions);
  if (!version) return { kind: 'unknown-version', requested };
  if (version.status === 'retired') return { kind: 'retired', version };

  return { kind: 'serve', version };
}

/**
 * The headers that announce a deprecation, as data so they can be asserted.
 *
 * `Deprecation` and `Sunset` are the standardised pair (draft-gregorio-httpapi-deprecation-header);
 * `Link; rel="successor-version"` is what a well-behaved client follows
 * automatically. `Warning` is the older header every HTTP stack already knows
 * how to log, so a client that ignores the others still leaves a trace.
 *
 * Silent removal is the failure mode this prevents. Announced removal is a
 * migration, and the difference is entirely whether the client was told in
 * advance.
 */
export function deprecationHeaders(params: {
  version: string;
  sunsetAt: string | undefined;
  successor: string;
  reason: string;
}): Record<string, string> {
  return {
    Deprecation: 'true',
    'X-API-Deprecated': params.version,
    ...(params.sunsetAt ? { Sunset: httpDate(params.sunsetAt) } : {}),
    // No leading slash before `successor`: it already carries one, and
    // `</api/v1>` is not a URL a client can follow.
    Link: `<${params.successor}>; rel="successor-version"`,
    Warning: `299 - "${params.reason}"`,
  };
}

/** The prefix of the version a client on `version` should move to. */
export function successorPrefix(version: string, current: string = CURRENT_API_VERSION): string {
  return version === current ? `/api/${version}` : `/api/${current}`;
}

export function apiVersionMiddleware(req: Request, res: Response, next: NextFunction): void {
  const originalUrl = req.originalUrl || req.url;
  const queryAt = originalUrl.indexOf('?');
  const query = queryAt === -1 ? '' : originalUrl.slice(queryAt);
  const segments = pathOnly(originalUrl).split('/').filter(Boolean);
  const root = segments[0];
  if (root === undefined) return next();

  // --- /api/... : the versioned surface ------------------------------------
  if (root === 'api') {
    const route = resolveVersionRoute(segments[1]);
    const path = pathOnly(originalUrl);

    switch (route.kind) {
      case 'missing-version':
        res.status(404).json(
          errorEnvelope({
            code: 'api_version_required',
            message: `An API version is required. Use ${API_PREFIX}.`,
            detail: {
              currentVersion: CURRENT_API_VERSION,
              supportedVersions: versionIds(),
              versionedPrefix: API_PREFIX,
            },
            path,
          }),
        );
        return;

      case 'not-a-version':
        res.status(404).json(
          errorEnvelope({
            code: 'api_version_required',
            message: `"${route.requested}" is not an API version. Use ${API_PREFIX}.`,
            detail: {
              currentVersion: CURRENT_API_VERSION,
              supportedVersions: versionIds(),
              versionedPrefix: API_PREFIX,
            },
            path,
          }),
        );
        return;

      case 'unknown-version':
        res.status(404).json(
          errorEnvelope({
            code: 'unsupported_api_version',
            message: `API version "${route.requested}" does not exist.`,
            detail: {
              requestedVersion: route.requested,
              currentVersion: CURRENT_API_VERSION,
              supportedVersions: versionIds(),
              versionedPrefix: API_PREFIX,
              note:
                'This is not a missing resource. The version itself is unknown, so ' +
                'nothing under this path was ever routable.',
            },
            path,
          }),
        );
        return;

      case 'retired':
        // 410, not 404. A 404 invites a client to try again or to look for a
        // typo; this version existed, and saying so is the whole message.
        res.status(410).json(
          errorEnvelope({
            code: 'api_version_retired',
            message: `API version "${route.version.id}" has been retired.`,
            detail: {
              requestedVersion: route.version.id,
              retiredAt: route.version.sunsetAt ?? null,
              successorVersion: CURRENT_API_VERSION,
              successorPrefix: API_PREFIX,
            },
            path,
          }),
        );
        return;

      case 'serve':
      default:
        res.setHeader('X-API-Version', route.version.id);
        if (route.version.status === 'deprecated') {
          for (const [name, value] of Object.entries(
            deprecationHeaders({
              version: route.version.id,
              sunsetAt: route.version.sunsetAt,
              successor: successorPrefix(route.version.id),
              reason: `"${route.version.id}" is deprecated. Move to ${API_PREFIX}.`,
            }),
          )) {
            res.setHeader(name, value);
          }
        }
        next();
        return;
    }
  }

  // --- operational endpoints: unversioned on purpose -----------------------
  if (unversionedSet.has(root)) {
    // Says so out loud rather than implying these belong to a version. A probe
    // pointed at `/health` must keep answering when `v1` is retired.
    res.setHeader('X-API-Version', 'unversioned');
    next();
    return;
  }

  // --- the transitional unversioned alias ----------------------------------
  if (LEGACY_UNVERSIONED_ALIAS.enabled && !isReserved(root)) {
    for (const [name, value] of Object.entries(
      deprecationHeaders({
        version: CURRENT_API_VERSION,
        sunsetAt: LEGACY_UNVERSIONED_ALIAS.sunsetAt,
        successor: LEGACY_UNVERSIONED_ALIAS.successorPrefix,
        reason: LEGACY_UNVERSIONED_ALIAS.reason,
      }),
    )) {
      res.setHeader(name, value);
    }
    res.setHeader('X-API-Version', CURRENT_API_VERSION);
    // Rewrite for routing only. `originalUrl` is deliberately left alone: it is
    // what the client actually sent, which is what an audit trail and an
    // operator reading logs need to see.
    req.url = `${API_PREFIX}/${segments.join('/')}${query}`;
    next();
    return;
  }

  next();
}

/**
 * A 404 inside a version we *do* serve.
 *
 * This is the other half of the distinction above, and it answers the question
 * the bare "Cannot GET" could not: which versions exist, and where do I start.
 * Nest raises it as a `NotFoundException`, so the exception filter is what
 * builds the response — see `AllExceptionsFilter`.
 */
export function versionNotFoundDetail() {
  return {
    currentVersion: CURRENT_API_VERSION,
    supportedVersions: versionIds(),
    versionedPrefix: API_PREFIX,
    unversionedPaths: [...UNVERSIONED_PATHS],
  };
}

export const apiVersionHandler: RequestHandler = apiVersionMiddleware;

/** Exported for the meta controller, which documents the registry it reads. */
export type { ApiVersion };