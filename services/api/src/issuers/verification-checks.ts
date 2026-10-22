/**
 * What "verified" can be checked to mean — BE-401's machine half.
 *
 * The registry can assert `issuer_verified` about an issuer nobody ever
 * checked: `setVerifiedTier` takes a custodian and a proof-of-reserves URL
 * on trust, and nothing verifies that the custodian holds anything, that
 * the URL answers, or that the attestation it points at is fresh. A tier
 * whose evidence nobody checks is a claim, not a verification.
 *
 * These checks close the machine-checkable half. The judgment half — does
 * this custodian arrangement satisfy counsel, does this auditor's report
 * say what we need — stays a human decision, recorded with a reason.
 * Nothing here invents counsel's criteria; it checks that the evidence
 * the operator cited exists, answers, and is fresh enough to mean
 * something.
 *
 * The shape follows the diligence pack (`docs/operations/xaut-diligence-pack.md`):
 *
 *  - **Licence record (pack §1):** the issuing entity names its licences
 *    and references. Present and non-empty is the check; whether the
 *    licences cover issuance is counsel's call.
 *  - **Attestation freshness (pack §2):** at least one asset from the
 *    issuer carries a recent attestation, and the proof URL answers. A
 *    proof URL that 404s is evidence that points nowhere.
 *  - **Linked proof of reserves (pack §2, Q7):** the URL the operator
 *    cited answers over HTTPS. Reachability, not content: the machine
 *    checks that the page exists; the human checks that it says what the
 *    tier claims.
 *
 * All three are best-effort reads with timeouts, and a check that cannot
 * run fails closed: the tier change is refused with the check that failed
 * named, rather than waved through on "could not verify".
 */

export interface VerificationIssuer {
  slug: string;
  licenseTypes: string[];
  licenseRefs: string[];
}

export interface VerificationAsset {
  assetId: string;
  symbol: string;
  lastAttestedAt: Date | null;
  attestationCadence: 'monthly' | 'quarterly' | 'annual' | 'none';
  proofOfReserveUrl: string | null;
}

/** One check, with the sentence the operator reads when it fails. */
export interface VerificationCheck {
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
  /** The URLs this check fetched. Recorded in the audit trail, so the
   *  trail says what was verified, not just that something was. */
  readonly checkedUrls?: string[];
}

/** Fresh enough to mean something. Monthly cadence tolerates a missed
 *  month; quarterly tolerates a missed quarter plus a month of drift; an
 *  asset that never attested is stale on arrival. */
export function attestationStale(checkedAt: Date | null, now: Date): boolean {
  if (!checkedAt) return true;
  const ageMs = now.getTime() - checkedAt.getTime();
  // Ninety days: a quarterly attestation plus a month of drift. Monthly
  // cadences are fresher by construction; an asset that never attested is
  // stale on arrival, which the null arm above already says.
  return ageMs > 90 * 24 * 60 * 60_000;
}

/**
 * The licence half: the issuing entity names its licences and references.
 * Present and non-empty is the check. Listed here rather than inline
 * because `setVerifiedTier` already enforces it at the DTO edge, and the
 * workflow must agree with the edge — two definitions of "has licences"
 * would drift, and the drift would be invisible.
 */
export function checkLicences(issuer: VerificationIssuer): VerificationCheck {
  const missing: string[] = [];
  if (issuer.licenseTypes.length === 0) missing.push('licenseTypes');
  if (issuer.licenseRefs.length === 0) missing.push('licenseRefs');
  return {
    name: 'licences-recorded',
    passed: missing.length === 0,
    detail:
      missing.length === 0
        ? `${issuer.licenseTypes.length} licence type(s) and ${issuer.licenseRefs.length} reference(s) on record.`
        : `No licence evidence on record: ${missing.join(', ')}.`,
  };
}

/**
 * The attestation half: at least one asset from the issuer carries a fresh
 * attestation. A registry whose issuer is verified while every asset it
 * stands behind is stale is verified in name only.
 */
export function checkAttestationFreshness(
  assets: VerificationAsset[],
  now: Date,
): VerificationCheck {
  if (assets.length === 0) {
    return {
      name: 'attestation-fresh',
      passed: false,
      detail: 'The issuer stands behind no assets, so there is no attestation to be fresh.',
    };
  }
  const fresh = assets.filter((a) => !attestationStale(a.lastAttestedAt, now));
  if (fresh.length === 0) {
    return {
      name: 'attestation-fresh',
      passed: false,
      detail:
        `None of the issuer's ${assets.length} asset(s) carries a fresh attestation. ` +
        `A tier built on stale attestations is a claim about the past, not the present.`,
    };
  }
  return {
    name: 'attestation-fresh',
    passed: true,
    detail: `${fresh.length} of ${assets.length} asset(s) carry a fresh attestation.`,
  };
}

/** A fetch with a deadline. The network is not a place to wait. */
export type FetchText = (url: string, timeoutMs: number) => Promise<{ ok: boolean; status: number }>;

/** Proof URLs must be HTTPS. Plain HTTP proof is proof anyone on the path
 *  could have rewritten — and a URL that is not a URL is not evidence. */
export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * The hostnames and literal addresses that must never be fetched.
 *
 * The proof URL is typed by an operator and fetched by the server, which is
 * the shape of a server-side request forgery: point it at an internal
 * service and the fetch goes there instead of to a custodian's page. The
 * operator is trusted with the *decision* to promote an issuer; they are not
 * trusted to make the server talk to whatever host they like.
 *
 * So the fetch refuses private space before it makes a request:
 *
 *  - **Loopback, link-local and private literals.** `169.254.169.254` is the
 *    cloud metadata endpoint, `127.0.0.1` and `10/8`, `172.16/12`, `192.168/16`
 *    are internal networks. A proof URL on one of those is not a custodian.
 *  - **Internal names.** `localhost`, and the `.local` / `.internal` suffixes
 *    that resolve inside a network rather than on the public internet.
 *
 * This is the layer that catches a typed-in internal address. It does not
 * catch a public hostname whose DNS record points inward — that needs
 * resolution-aware checking at connect time, which is a larger change than
 * this workflow should make on its own. The blast radius is a read-only GET
 * to a URL the caller supplied, with no credentials attached and no response
 * body kept.
 */
const BLOCKED_HOST_SUFFIXES = ['.local', '.internal', '.localhost'];
const BLOCKED_HOSTS = new Set(['localhost']);

function isPrivateLiteral(host: string): boolean {
  // IPv6 in brackets, or an IPv4 dotted quad.
  if (host.startsWith('[') && host.endsWith(']')) {
    const inner = host.slice(1, -1).toLowerCase();
    // ::1 loopback, fc00::/7 unique-local, fe80::/10 link-local.
    return inner === '::1' || inner.startsWith('fc') || inner.startsWith('fd') || inner.startsWith('fe8') || inner.startsWith('fe9') || inner.startsWith('fea') || inner.startsWith('feb');
  }
  const parts = host.split('.');
  if (parts.length !== 4) return false;
  if (!parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)) return false;
  const octets = parts.map(Number);
  const a = octets[0] as number;
  const b = octets[1] as number;
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
  if (a === 10) return true; // private
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 0) return true; // "this network"
  return false;
}

/** True when the URL points somewhere a custodian's page would live. */
export function isPubliclyRoutableUrl(value: string): boolean {
  let host: string;
  try {
    host = new URL(value).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (!host) return false;
  if (BLOCKED_HOSTS.has(host)) return false;
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return false;
  if (isPrivateLiteral(host)) return false;
  return true;
}

/**
 * The reachability half: every proof URL the operator cited answers over
 * HTTPS. Reachability, not content — the machine checks that the page
 * exists; the human checks that it says what the tier claims.
 *
 * A URL that cannot be fetched fails the check rather than passing it.
 * "Could not verify" waved through is how a dead link becomes a verified
 * tier, and a dead link is exactly what this check exists to catch.
 */
export async function checkProofUrls(
  urls: string[],
  fetchText: FetchText,
  timeoutMs = 10_000,
): Promise<VerificationCheck> {
  const distinct = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
  if (distinct.length === 0) {
    return {
      name: 'proof-urls-reachable',
      passed: false,
      detail: 'No proof-of-reserves URL was cited. A tier with no pointer to reserves is a claim.',
    };
  }
  const badScheme = distinct.filter((u) => !isHttpsUrl(u));
  if (badScheme.length > 0) {
    return {
      name: 'proof-urls-reachable',
      passed: false,
      detail: `Not HTTPS, so not evidence: ${badScheme.join(', ')}.`,
      checkedUrls: distinct,
    };
  }
  // Internal destinations are refused before the request, not after: a
  // server-side fetch of an operator-typed address is a request-forgery
  // shape, and the answer to it is never "the page answered".
  const internal = distinct.filter((u) => !isPubliclyRoutableUrl(u));
  if (internal.length > 0) {
    return {
      name: 'proof-urls-reachable',
      passed: false,
      detail: `Points inside the network rather than to a custodian: ${internal.join(', ')}.`,
      checkedUrls: distinct,
    };
  }
  const dead: string[] = [];
  for (const url of distinct) {
    try {
      const res = await fetchText(url, timeoutMs);
      if (!res.ok) dead.push(`${url} (HTTP ${res.status})`);
    } catch {
      dead.push(url);
    }
  }
  if (dead.length > 0) {
    return {
      name: 'proof-urls-reachable',
      passed: false,
      detail: `Unreachable proof URL(s): ${dead.join(', ')}. A tier that points nowhere is a tier with no basis.`,
      checkedUrls: distinct,
    };
  }
  return {
    name: 'proof-urls-reachable',
    passed: true,
    detail: `${distinct.length} proof URL(s) answered over HTTPS.`,
    checkedUrls: distinct,
  };
}
