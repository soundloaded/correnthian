/**
 * The proof-URL port — the seam the machine half of verification uses to
 * reach the outside world.
 *
 * A verification that cites `https://example.com/por.pdf` is only a
 * verification if something actually asks that page. So the check fetches
 * it. Which means the fetch is a dependency like any other, and it sits
 * behind a token for the same reason the email transport and the screening
 * provider do: the suites must be able to replace it, and a deployment that
 * cannot reach a proof URL must fail the promotion rather than wave it
 * through.
 *
 * Two rules every implementation keeps:
 *
 *  - **Reachability, not content.** The machine asks whether the page
 *    answers; the human reads it. A fetch that returns 200 proves the
 *    document is there, not that it says what the tier claims.
 *  - **Absence of an answer is a failure, not a pass.** A transport that
 *    cannot reach the URL throws or reports not-ok. It never reports
 *    success, because "could not verify" is the one outcome a badge must
 *    never be granted on.
 */
import type { FetchText } from './verification-checks.js';

export const VERIFICATION_FETCH = 'correnthian:verification-fetch';

/**
 * The real implementation: an HTTPS request with a deadline.
 *
 * The network is not a place to wait. A proof URL that hangs must fail the
 * check rather than hold a request open until the operator gives up.
 */
export const httpVerificationFetch: FetchText = async (url: string, timeoutMs: number) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    return { ok: res.ok, status: res.status };
  } finally {
    clearTimeout(timer);
  }
};
