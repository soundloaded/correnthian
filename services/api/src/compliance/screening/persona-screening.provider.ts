import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  ScreeningProvider, ScreeningUnavailableError,
} from './screening-provider.js';
import type {
  CreatedInquiry, InquiryDecision, ParsedWebhookEvent, Screening,
  ScreeningVerdict, WatchlistResult,
} from './screening-provider.js';

export interface PersonaCredentials {
  apiKey: string;
  webhookSecret: string;
  baseUrl: string;
}

/**
 * Persona behind the ScreeningProvider port.
 *
 * VERIFY-AGAINST-DOCS — every Persona literal below is an assumption until
 * checked against their docs (unavailable when this was written: the docs
 * MCP was unreachable and web search unauthorized in-session). The list to
 * verify, in order of blast radius: the `persona-signature` header scheme
 * (`t=`/`v1=` over `<timestamp>.<raw body>`), the inquiry-creation path and
 * `reference-id` field, the re-screen path, the event `type` names, and the
 * `status`/`watchlist` vocabularies. The spec pins the implemented shape so
 * any correction breaks loudly there. Nothing architectural depends on these
 * names — the port, the state machine and the gates do not change whatever
 * the literals turn out to be.
 */

/** VERIFY-AGAINST-DOCS: header carrying the webhook signature. Exported so
 *  the controller reads the same literal this adapter verifies — one name in
 *  one place, corrected once when the docs say otherwise. */
export const PERSONA_SIGNATURE_HEADER = 'persona-signature';
/** VERIFY-AGAINST-DOCS: replay tolerance for webhook timestamps. */
const TIMESTAMP_TOLERANCE_SECONDS = 300;

const VERDICTS: Record<string, ScreeningVerdict> = {
  // VERIFY-AGAINST-DOCS: vendor status vocabulary.
  passed: 'passed',
  failed: 'declined',
  declined: 'declined',
  needs_review: 'needs_review',
};

const WATCHLISTS: Record<string, WatchlistResult> = {
  // VERIFY-AGAINST-DOCS: vendor watchlist vocabulary.
  clear: 'clean',
  no_match: 'clean',
  consider: 'hit',
  match: 'hit',
};

/** A `fetch` narrow enough to stub: status, ok, and a JSON body. */
export interface PersonaHttp {
  (url: string, init: { method: string; headers: Record<string, string>; body: string }): Promise<{
    ok: boolean;
    status: number;
    json: () => Promise<unknown>;
  }>;
}

export class PersonaScreeningProvider extends ScreeningProvider {
  readonly name = 'persona';

  constructor(
    private readonly credentials: PersonaCredentials,
    private readonly http: PersonaHttp = fetch as unknown as PersonaHttp,
  ) {
    super();
  }

  async createInquiry(userId: string): Promise<CreatedInquiry> {
    // VERIFY-AGAINST-DOCS: creation path and reference field.
    const res = await this.http(`${this.credentials.baseUrl}/inquiries`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.credentials.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 'reference-id': userId }),
    });
    if (!res.ok) {
      // The vendor's error payload stays vendor-side: refusal bodies echo
      // request fields, and request fields here are identity-adjacent.
      throw new ScreeningUnavailableError(`Persona refused inquiry creation (status ${res.status})`);
    }
    const payload = (await res.json()) as { data?: { id?: unknown; session_token?: unknown } };
    if (typeof payload.data?.id !== 'string' || typeof payload.data?.session_token !== 'string') {
      throw new ScreeningUnavailableError('Persona answered without an inquiry id and session token');
    }
    return { inquiryId: payload.data.id, sessionToken: payload.data.session_token };
  }

  async rescreen(userId: string): Promise<Screening> {
    // VERIFY-AGAINST-DOCS: re-screen path.
    const res = await this.http(
      `${this.credentials.baseUrl}/inquiries/reference/${encodeURIComponent(userId)}/watchlist`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.credentials.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      },
    );
    if (!res.ok) {
      throw new ScreeningUnavailableError(`Persona refused a watchlist screen (status ${res.status})`);
    }
    const payload = (await res.json()) as { data?: { result?: unknown; screened_at?: unknown } };
    const result = typeof payload.data?.result === 'string' ? WATCHLISTS[payload.data.result] : undefined;
    if (!result) {
      throw new ScreeningUnavailableError('Persona answered a screen with an unrecognised result');
    }
    return { result, screenedAt: new Date() };
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    // VERIFY-AGAINST-DOCS: `t=<unix>,v1=<hex hmac of "<t>.<raw body>">`.
    const timestamp = /^t=(\d+),v1=([0-9a-f]+)$/.exec(signature.trim());
    if (!timestamp?.[1] || !timestamp?.[2]) return false;

    const ageSeconds = Math.floor(Date.now() / 1000) - Number(timestamp[1]);
    if (ageSeconds < 0 || ageSeconds > TIMESTAMP_TOLERANCE_SECONDS) return false;

    let expected: Buffer;
    try {
      expected = Buffer.from(timestamp[2], 'hex');
    } catch {
      return false;
    }
    const actual = createHmac('sha256', this.credentials.webhookSecret)
      .update(`${timestamp[1]}.${rawBody.toString('utf8')}`)
      .digest();
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  parseWebhookEvent(body: unknown): ParsedWebhookEvent {
    // VERIFY-AGAINST-DOCS: the whole envelope — `type`, `created_at`, and
    // `data.{id,reference_id,status,watchlist}`. Anything else is rejected:
    // a lenient parser here is how an unknown vendor change becomes a
    // misapplied verdict.
    if (!body || typeof body !== 'object') {
      throw new ScreeningUnavailableError('unrecognised Persona event shape: not an object');
    }
    const event = body as Record<string, unknown>;
    const data = event['data'];
    if (
      typeof event['id'] !== 'string' ||
      typeof event['type'] !== 'string' ||
      !data || typeof data !== 'object'
    ) {
      throw new ScreeningUnavailableError('unrecognised Persona event shape: missing id, type or data');
    }
    const detail = data as Record<string, unknown>;
    if (typeof detail['id'] !== 'string') {
      throw new ScreeningUnavailableError('unrecognised Persona event shape: data without inquiry id');
    }

    const occurredAt = typeof event['created_at'] === 'string' && !Number.isNaN(Date.parse(event['created_at']))
      ? new Date(event['created_at'])
      : new Date();

    let decision: InquiryDecision | null = null;
    if (typeof detail['status'] === 'string') {
      const verdict = VERDICTS[detail['status']];
      if (!verdict) {
        throw new ScreeningUnavailableError(
          `unrecognised Persona inquiry status: ${JSON.stringify(detail['status'])}`,
        );
      }
      const watchlistRaw = typeof detail['watchlist'] === 'string' ? detail['watchlist'] : 'clear';
      const watchlist = WATCHLISTS[watchlistRaw];
      if (!watchlist) {
        throw new ScreeningUnavailableError(
          `unrecognised Persona watchlist result: ${JSON.stringify(detail['watchlist'])}`,
        );
      }
      const codes = Array.isArray(detail['codes'])
        ? detail['codes'].filter((c): c is string => typeof c === 'string')
        : [];
      decision = { verdict, watchlist, codes, occurredAt };
    }

    return {
      eventId: event['id'],
      inquiryId: detail['id'],
      referenceId: typeof detail['reference_id'] === 'string' ? detail['reference_id'] : null,
      occurredAt,
      decision,
    };
  }
}
