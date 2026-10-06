/**
 * The API version registry.
 *
 * This file is the answer to "how does a version get retired", and it is data
 * rather than prose so that retiring one is a commit rather than a code change
 * scattered across handlers.
 *
 * The lifecycle:
 *
 *   current    — the version every new integration should target.
 *   deprecated — still served, unchanged, and still the *only* safe target for
 *                a client that cannot migrate yet. Every response carries
 *                `Deprecation`, `Sunset` and `Link: rel="successor-version"`,
 *                so a client still on it is loud in its own logs well before
 *                the date. Silent removal is the failure mode; announced
 *                removal is a migration.
 *   retired    — no longer routed. Requests get `410 Gone` naming the
 *                replacement, never a bare 404, because "this version is gone"
 *                and "this route does not exist" call for different client
 *                behaviour and a 404 for both is how a client silently stops
 *                working.
 *
 * Nothing here is inferred from the date at runtime. A version is retired when
 * a human changes `status`, because "it is past the sunset date so we must have
 * migrated every client" is an assumption no system can actually make.
 */

export type ApiVersionStatus = 'current' | 'deprecated' | 'retired';

export interface ApiVersion {
  readonly id: string;
  readonly status: ApiVersionStatus;
  /** ISO date. Informational. */
  readonly releasedAt: string;
  /** ISO datetime. Required once `status` is `deprecated` or `retired`. */
  readonly sunsetAt?: string;
}

export const CURRENT_API_VERSION = 'v1';

/**
 * Every version this deployment knows about, newest first.
 *
 * Adding `v2` means appending an entry here and pointing
 * `CURRENT_API_VERSION` at it. `v1` does not change shape — that is the entire
 * point of the exercise, and it is why a client written against `/api/v1`
 * today keeps working when `/api/v2` ships.
 */
export const API_VERSIONS: readonly ApiVersion[] = [
  { id: 'v1', status: 'current', releasedAt: '2026-10-06' },
];

/** The canonical, versioned prefix. Every other version lives beside it. */
export const API_PREFIX = `/api/${CURRENT_API_VERSION}`;

/**
 * Paths served outside any version.
 *
 * `/health` is the deliberate exception. An orchestrator's liveness and
 * readiness probes are configured in a cluster manifest, not by an application
 * team that reads changelogs — versioning them would mean that rotating
 * through a deprecation means restarting or reconfiguring the cluster, or
 * worse, leaving a probe pointed at a version that gets removed. A probe must
 * keep working for as long as the process does. The same argument applies to
 * `/docs`, which a human reads rather than a client calls.
 *
 * Their payloads are deliberately trivial and version-free so nothing in them
 * can rot when a version moves on.
 */
export const UNVERSIONED_PATHS = ['health', 'docs', 'docs-json'] as const;

/**
 * The transitional unversioned alias.
 *
 * Why it exists: the admin console is being written against this API right
 * now. Introducing `/api/v1` as the enforced prefix while unversioned routes
 * vanish would break work in flight — which is precisely the failure this task
 * exists to prevent, just aimed the other way.
 *
 * So the versioned prefix is canonical and the unversioned form is a shim
 * that answers for a bounded period, and every response it produces announces
 * its own removal. It is not a second supported API and must not be treated as
 * one. When `sunsetAt` passes, the entry below is deleted, the alias stops
 * answering, and clients get the version 404 that names the versions that do.
 */
/**
 * When the unversioned alias stops answering. Long enough for the admin and
 * mobile to move, short enough that nobody builds on it.
 */
const LEGACY_ALIAS_SUNSET_AT = '2026-12-01T00:00:00.000Z';

export const LEGACY_UNVERSIONED_ALIAS = {
  enabled: true,
  sunsetAt: LEGACY_ALIAS_SUNSET_AT,
  successorPrefix: API_PREFIX,
  reason:
    'This endpoint is being served from the transitional unversioned address. ' +
    `Move to ${API_PREFIX}; the unversioned address is removed after ` +
    `${LEGACY_ALIAS_SUNSET_AT}.`,
} as const;

/** Versions this process will actually route. */
export function routableVersions(): ApiVersion[] {
  return API_VERSIONS.filter((v) => v.status !== 'retired');
}

export function findVersion(
  id: string,
  versions: readonly ApiVersion[] = API_VERSIONS,
): ApiVersion | undefined {
  return versions.find((v) => v.id === id);
}

export function versionIds(versions: readonly ApiVersion[] = API_VERSIONS): string[] {
  return versions.filter((v) => v.status !== 'retired').map((v) => v.id);
}

/** The document `GET /api/v1/meta/versions` returns. */
export function versionsDocument() {
  return {
    currentVersion: CURRENT_API_VERSION,
    versionedPrefix: API_PREFIX,
    versions: API_VERSIONS.map((v) => ({
      id: v.id,
      status: v.status,
      releasedAt: v.releasedAt,
      sunsetAt: v.sunsetAt ?? null,
      path: `/api/${v.id}`,
    })),
    unversionedPaths: [...UNVERSIONED_PATHS],
    legacyUnversionedAlias: {
      enabled: LEGACY_UNVERSIONED_ALIAS.enabled,
      sunsetAt: LEGACY_UNVERSIONED_ALIAS.sunsetAt,
      successorPrefix: LEGACY_UNVERSIONED_ALIAS.successorPrefix,
    },
    errorCodes: {
      /** A version we do not serve, or never will. */
      unsupportedApiVersion: 'unsupported_api_version',
      /** `/api/...` with no version at all. */
      apiVersionRequired: 'api_version_required',
      /** A version whose sunset date has passed. */
      apiVersionRetired: 'api_version_retired',
      /** A path that does not exist inside a version we do serve. */
      notFound: 'not_found',
    },
  };
}