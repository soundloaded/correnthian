import { describe, expect, it } from 'vitest';
import {
  attestationStale,
  checkAttestationFreshness,
  checkLicences,
  checkProofUrls,
  isHttpsUrl,
  isPubliclyRoutableUrl,
  type VerificationAsset,
  type VerificationIssuer,
} from './verification-checks.js';

/**
 * The machine half of verification — BE-401.
 *
 * Two properties the tests pin because getting them subtly wrong is the
 * failure mode:
 *
 *  - **Unverifiable fails, never passes.** A proof URL that 404s, a fetch
 *    that throws, an asset that never attested — each is a failed check,
 *    not a skipped one. "Could not verify" waved through is how a dead
 *    link becomes a verified tier.
 *  - **The workflow agrees with the edge.** `setVerifiedTier` already
 *    refuses a promotion without licences at the DTO edge; the checks
 *    recompute that definition from one place rather than restating it.
 *    Two definitions of "has licences" would drift, and the drift would
 *    be invisible.
 */

const T0 = new Date('2026-10-22T06:00:00.000Z');
const daysAgo = (n: number) => new Date(T0.getTime() - n * 24 * 60 * 60_000);

const issuer = (over: Partial<VerificationIssuer> = {}): VerificationIssuer => ({
  slug: 'paxos',
  licenseTypes: ['trust-company'],
  licenseRefs: ['nydfs-1'],
  ...over,
});

const asset = (over: Partial<VerificationAsset> = {}): VerificationAsset => ({
  assetId: '1:0xtoken:iss',
  symbol: 'PAXG',
  lastAttestedAt: daysAgo(10),
  attestationCadence: 'monthly',
  proofOfReserveUrl: 'https://example.com/proof',
  ...over,
});

describe('checkLicences', () => {
  it('passes when licences and references are both on record', () => {
    const check = checkLicences(issuer());
    expect(check.passed).toBe(true);
  });

  it('fails when either half is missing, and names which', () => {
    expect(checkLicences(issuer({ licenseTypes: [] })).passed).toBe(false);
    expect(checkLicences(issuer({ licenseRefs: [] })).passed).toBe(false);
    expect(checkLicences(issuer({ licenseTypes: [], licenseRefs: [] })).detail).toMatch(
      /licenseTypes, licenseRefs/,
    );
  });
});

describe('attestation freshness', () => {
  it('a recent attestation is fresh', () => {
    expect(attestationStale(daysAgo(10), T0)).toBe(false);
  });

  it('an asset that never attested is stale on arrival', () => {
    expect(attestationStale(null, T0)).toBe(true);
  });

  it('an attestation older than the window is stale', () => {
    expect(attestationStale(daysAgo(120), T0)).toBe(true);
  });

  it('an issuer with no assets has no attestation to be fresh', () => {
    const check = checkAttestationFreshness([], T0);
    expect(check.passed).toBe(false);
  });

  it('one fresh asset among stale ones passes, and says how many', () => {
    const check = checkAttestationFreshness(
      [asset({ lastAttestedAt: daysAgo(200) }), asset({ lastAttestedAt: daysAgo(5) })],
      T0,
    );
    expect(check.passed).toBe(true);
    expect(check.detail).toContain('1 of 2');
  });

  it('all stale fails, and says the tier would describe the past', () => {
    const check = checkAttestationFreshness([asset({ lastAttestedAt: daysAgo(200) })], T0);
    expect(check.passed).toBe(false);
  });
});

describe('proof URLs', () => {
  const ok = async () => ({ ok: true, status: 200 });

  it('rejects non-HTTPS and non-URLs without fetching', async () => {
    const seen: string[] = [];
    const check = await checkProofUrls(
      ['http://example.com/proof', 'not a url'],
      async (url) => {
        seen.push(url);
        return ok();
      },
    );
    expect(check.passed).toBe(false);
    expect(seen).toEqual([]);
  });

  it('fails a URL that answers with an error status, and names it', async () => {
    const check = await checkProofUrls(['https://example.com/gone'], async () => ({
      ok: false,
      status: 404,
    }));
    expect(check.passed).toBe(false);
    expect(check.detail).toContain('404');
  });

  it('fails a URL that cannot be fetched, rather than waving it through', async () => {
    const check = await checkProofUrls(['https://down.example/proof'], async () => {
      throw new Error('connection reset');
    });
    expect(check.passed).toBe(false);
    expect(check.detail).toContain('Unreachable');
  });

  it('passes when every cited URL answers', async () => {
    const check = await checkProofUrls(
      ['https://a.example/proof', 'https://b.example/audit.pdf'],
      ok,
    );
    expect(check.passed).toBe(true);
    expect(check.checkedUrls).toHaveLength(2);
  });

  it('fails when no URL was cited at all', async () => {
    const check = await checkProofUrls([], ok);
    expect(check.passed).toBe(false);
  });
});

describe('isHttpsUrl', () => {
  it('accepts https and rejects everything else', () => {
    expect(isHttpsUrl('https://example.com/x')).toBe(true);
    expect(isHttpsUrl('http://example.com/x')).toBe(false);
    expect(isHttpsUrl('not a url')).toBe(false);
  });
});

describe('isPubliclyRoutableUrl', () => {
  it('accepts an ordinary public host', () => {
    expect(isPubliclyRoutableUrl('https://example.com/proof')).toBe(true);
    expect(isPubliclyRoutableUrl('https://proof.custodian.io/por.pdf')).toBe(true);
  });

  it('refuses loopback and the cloud metadata endpoint', () => {
    // The proof URL is typed by an operator and fetched by the server.
    // Pointing it at 169.254.169.254 turns the check into a request to
    // whatever the host is, so it is refused before the request is made.
    expect(isPubliclyRoutableUrl('https://169.254.169.254/latest/meta-data')).toBe(false);
    expect(isPubliclyRoutableUrl('https://127.0.0.1/proof')).toBe(false);
    expect(isPubliclyRoutableUrl('https://[::1]/proof')).toBe(false);
  });

  it('refuses private network literals', () => {
    expect(isPubliclyRoutableUrl('https://10.0.0.5/proof')).toBe(false);
    expect(isPubliclyRoutableUrl('https://172.16.4.1/proof')).toBe(false);
    expect(isPubliclyRoutableUrl('https://172.32.4.1/proof')).toBe(true);
    expect(isPubliclyRoutableUrl('https://192.168.1.1/proof')).toBe(false);
  });

  it('refuses internal names', () => {
    expect(isPubliclyRoutableUrl('https://localhost/proof')).toBe(false);
    expect(isPubliclyRoutableUrl('https://vault.internal/proof')).toBe(false);
    expect(isPubliclyRoutableUrl('https://printer.local/proof')).toBe(false);
  });

  it('refuses a value that is not a URL', () => {
    expect(isPubliclyRoutableUrl('not a url')).toBe(false);
  });
});

describe('checkProofUrls and internal destinations', () => {
  it('refuses an internal address without fetching it', async () => {
    const seen: string[] = [];
    const check = await checkProofUrls(
      ['https://169.254.169.254/latest/meta-data'],
      async (url) => {
        seen.push(url);
        return { ok: true, status: 200 };
      },
    );
    expect(check.passed).toBe(false);
    // The request was never made — the refusal is before the fetch, not
    // after an answer came back.
    expect(seen).toEqual([]);
  });
});
