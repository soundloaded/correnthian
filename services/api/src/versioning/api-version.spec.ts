import { describe, expect, it } from 'vitest';
import {
  API_PREFIX,
  API_VERSIONS,
  CURRENT_API_VERSION,
  routableVersions,
  versionIds,
  versionsDocument,
  type ApiVersion,
} from './api-versions.js';
import { deprecationHeaders, resolveVersionRoute, successorPrefix } from './api-version.middleware.js';

/**
 * The version lifecycle, without waiting for a second version to exist.
 *
 * `resolveVersionRoute` takes the registry as an argument precisely so these
 * cases can be exercised today. The alternative — asserting against the live
 * registry — would leave the deprecation and retirement branches unreachable
 * until the day a version actually retires, which is the day it matters most
 * and the worst day to discover they were wrong.
 */

/** A registry that has lived a full life: one current, one on its way out, one gone. */
const LIFECYCLE: readonly ApiVersion[] = [
  { id: 'v3', status: 'current', releasedAt: '2027-01-01' },
  { id: 'v2', status: 'deprecated', releasedAt: '2026-06-01', sunsetAt: '2027-06-01T00:00:00.000Z' },
  { id: 'v1', status: 'retired', releasedAt: '2026-01-01', sunsetAt: '2026-12-01T00:00:00.000Z' },
];

describe('the shipped registry', () => {
  it('names v1 as current and derives the prefix from it', () => {
    expect(CURRENT_API_VERSION).toBe('v1');
    expect(API_PREFIX).toBe('/api/v1');
    // Derived, not duplicated. A prefix written out separately is a prefix
    // that disagrees with the registry the first time a version is added.
    expect(API_PREFIX).toBe(`/api/${CURRENT_API_VERSION}`);
  });

  it('has exactly one current version, and it is the one the prefix names', () => {
    const current = API_VERSIONS.filter((v) => v.status === 'current');
    expect(current).toHaveLength(1);
    expect(current[0]?.id).toBe(CURRENT_API_VERSION);
  });

  it('gives every deprecated or retired version a sunset date', () => {
    // A deprecation without a date is a deprecation nobody can plan around,
    // which is the same as no announcement at all.
    for (const version of API_VERSIONS.filter((v) => v.status !== 'current')) {
      expect(version.sunsetAt, `${version.id} has no sunsetAt`).toBeTruthy();
      expect(Number.isNaN(new Date(version.sunsetAt as string).getTime())).toBe(false);
    }
  });

  it('serves the current version and nothing else', () => {
    expect(versionIds()).toEqual([CURRENT_API_VERSION]);
    expect(routableVersions().map((v) => v.id)).toEqual([CURRENT_API_VERSION]);
  });

  it('publishes a document that describes this deployment', () => {
    const doc = versionsDocument();
    expect(doc.currentVersion).toBe(CURRENT_API_VERSION);
    expect(doc.versionedPrefix).toBe(API_PREFIX);
    expect(doc.versions.map((v) => v.id)).toContain(CURRENT_API_VERSION);
    // `/health` is the one that matters: an orchestrator reads this document
    // and needs to see that the probe is outside the version scheme.
    expect(doc.unversionedPaths).toContain('health');
    expect(doc.legacyUnversionedAlias.successorPrefix).toBe(API_PREFIX);
    expect(doc.errorCodes.unsupportedApiVersion).toBe('unsupported_api_version');
  });
});

describe('resolveVersionRoute', () => {
  it('serves the current version', () => {
    const route = resolveVersionRoute('v3', LIFECYCLE);
    expect(route.kind).toBe('serve');
    expect(route.kind === 'serve' && route.version.id).toBe('v3');
  });

  it('still serves a deprecated version, unchanged', () => {
    // Deprecated means "stop using this", not "this stopped working". Cutting
    // a client off on the announcement is how a deprecation becomes an outage.
    const route = resolveVersionRoute('v2', LIFECYCLE);
    expect(route.kind).toBe('serve');
    expect(route.kind === 'serve' && route.version.status).toBe('deprecated');
  });

  it('refuses to route a retired version', () => {
    const route = resolveVersionRoute('v1', LIFECYCLE);
    expect(route.kind).toBe('retired');
    expect(route.kind === 'retired' && route.version.sunsetAt).toBe('2026-12-01T00:00:00.000Z');
  });

  it('tells a missing version apart from an unknown one', () => {
    expect(resolveVersionRoute(undefined, LIFECYCLE)).toEqual({ kind: 'missing-version' });
    expect(resolveVersionRoute('assets', LIFECYCLE)).toEqual({
      kind: 'not-a-version',
      requested: 'assets',
    });
    expect(resolveVersionRoute('v9', LIFECYCLE)).toEqual({
      kind: 'unknown-version',
      requested: 'v9',
    });
  });

  it('does not mistake a path segment for a version', () => {
    // `/api/assets` must not read as "version assets".
    expect(resolveVersionRoute('assets', LIFECYCLE).kind).toBe('not-a-version');
    expect(resolveVersionRoute('vNext', LIFECYCLE).kind).toBe('not-a-version');
    expect(resolveVersionRoute('2', LIFECYCLE).kind).toBe('not-a-version');
  });
});

describe('successorPrefix', () => {
  it('points a deprecated version at the current one', () => {
    expect(successorPrefix('v2', 'v3')).toBe('/api/v3');
  });

  it('does not point a version at itself when it is already current', () => {
    expect(successorPrefix('v3', 'v3')).toBe('/api/v3');
  });
});

describe('deprecationHeaders', () => {
  it('produces a followable successor link and an HTTP-date sunset', () => {
    const headers = deprecationHeaders({
      version: 'v2',
      sunsetAt: '2027-06-01T00:00:00.000Z',
      successor: '/api/v3',
      reason: '"v2" is deprecated.',
    });

    expect(headers['Deprecation']).toBe('true');
    expect(headers['X-API-Deprecated']).toBe('v2');
    // RFC 1123, which is what `Sunset` is specified to carry. An ISO string
    // here looks right in a log and is not the format a client parses.
    expect(headers['Sunset']).toBe(new Date('2027-06-01T00:00:00.000Z').toUTCString());
    expect(headers['Link']).toBe('</api/v3>; rel="successor-version"');
    expect(headers['Warning']).toMatch(/^299 - "/);
  });

  it('omits Sunset rather than inventing one', () => {
    const headers = deprecationHeaders({
      version: 'v2',
      sunsetAt: undefined,
      successor: '/api/v3',
      reason: 'deprecated',
    });
    expect(headers).not.toHaveProperty('Sunset');
  });
});
