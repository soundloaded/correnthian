import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  ScreeningProvider, ScreeningUnavailableError,
} from './screening-provider.js';
import type {
  CreatedInquiry, ParsedWebhookEvent, Screening,
  ScreeningVerdict, WatchlistResult,
} from './screening-provider.js';

export interface PersonaCredentials {
  apiKey: string;
  webhookSecret: string;
  baseUrl: string;
  /** Required for inquiry creation (the API takes no inquiry without a
   *  template). Optional in the type so the adapter can be constructed
   *  wherever credentials are partial — creating without it throws
   *  rather than sending a known-bad call. */
  templateId?: string;
}

/**
 * Persona behind the ScreeningProvider port.
 *
 * Verified against the docs 2026-10-10 (api host, JSON:API envelopes, event
 * names, inquiry/report endpoints and field vocabularies). Residual
 * VERIFY-AGAINST-DOCS marks remain only where the docs show structure but
 * no verbatim example: the inquiry-approval payload's exact attribute
 * layout, and whether `reference-id` rides inline on every inquiry event's
 * attributes. If either differs, the binding fallback (reverse lookup by
 * inquiry id) still holds — it was built for exactly that case.
 */

/** Verified: the header is `Persona-Signature` (matched case-insensitively —
 *  Express lowercases incoming headers, so the constant is lowercase). */
export const PERSONA_SIGNATURE_HEADER = 'persona-signature';
/** Our replay policy, not Persona's: the docs specify no tolerance, so the
 *  bound lives here and is stated as ours. */
const TIMESTAMP_TOLERANCE_SECONDS = 300;

/** Verified: inquiry lifecycle event names. A bare status never arrives on
 *  the wire — only these names — so the keys are names, not statuses. */
const INQUIRY_VERDICTS: Record<string, ScreeningVerdict> = {
  'inquiry.approved': 'passed',
  'inquiry.declined': 'declined',
  'inquiry.marked-for-review': 'needs_review',
  'inquiry.failed': 'declined',
};

/** A `fetch` narrow enough to stub: status, ok, and a JSON body. */
export interface PersonaHttp {
  (url: string, init: { method: string; headers: Record<string, string>; body: string }): Promise<{
    ok: boolean;
    status: number;
    json: () => Promise<unknown>;
  }>;
}

/** How long a created report may take to become readable before the call
 *  gives up and fails closed. The gate waits on this inline, so the bound
 *  is the worst case added to a fiat movement's latency. */
const RESCREEN_POLL_ATTEMPTS = 4;
const RESCREEN_POLL_MS = 500;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export class PersonaScreeningProvider extends ScreeningProvider {
  readonly name = 'persona';

  constructor(
    private readonly credentials: PersonaCredentials,
    private readonly http: PersonaHttp = fetch as unknown as PersonaHttp,
  ) {
    super();
  }

  async createInquiry(userId: string): Promise<CreatedInquiry> {
    if (!this.credentials.templateId) {
      throw new ScreeningUnavailableError('no Persona inquiry template configured');
    }
    // Verified: POST /api/v1/inquiries with a template id; the reference
    // binds our user (reference-id itself is deprecated in favour of
    // meta.auto-create-account-reference-id); the session token arrives in
    // meta.session-token only when auto-create-inquiry-session is true.
    const res = await this.http(`${this.credentials.baseUrl}/inquiries`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.credentials.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          type: 'inquiry',
          attributes: { 'inquiry-template-id': this.credentials.templateId },
        },
        meta: {
          'auto-create-inquiry-session': true,
          'auto-create-account-reference-id': userId,
        },
      }),
    });
    if (!res.ok) {
      // The vendor's error payload stays vendor-side: refusal bodies echo
      // request fields, and request fields here are identity-adjacent.
      throw new ScreeningUnavailableError(`Persona refused inquiry creation (status ${res.status})`);
    }
    const payload = (await res.json()) as {
      data?: { id?: unknown };
      meta?: { 'session-token'?: unknown };
    };
    if (typeof payload.data?.id !== 'string' || typeof payload.meta?.['session-token'] !== 'string') {
      throw new ScreeningUnavailableError('Persona answered without an inquiry id and session token');
    }
    return { inquiryId: payload.data.id, sessionToken: payload.meta['session-token'] };
  }

  async rescreen(userId: string, inquiryId?: string): Promise<Screening> {
    if (!inquiryId) {
      // A watchlist report unlinked to anything is a screen of nobody: it
      // would return a result with no subject, and the gate would file it
      // against the wrong question.
      throw new ScreeningUnavailableError('re-screen needs the inquiry to link the report to');
    }
    // Verified: POST /api/v1/reports with type report/watchlist, linked
    // through data.relationships.inquiry so the vendor screens the
    // inquiry's own PII — ours never crosses in the request.
    const created = await this.http(`${this.credentials.baseUrl}/reports`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.credentials.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          type: 'report/watchlist',
          relationships: { inquiry: { data: { type: 'inquiry', id: inquiryId } } },
        },
      }),
    });
    if (!created.ok) {
      throw new ScreeningUnavailableError(`Persona refused a watchlist report (status ${created.status})`);
    }
    const createdBody = (await created.json()) as { data?: { id?: unknown } };
    if (typeof createdBody.data?.id !== 'string') {
      throw new ScreeningUnavailableError('Persona answered a report without an id');
    }
    const reportId = createdBody.data.id;

    for (let attempt = 0; attempt < RESCREEN_POLL_ATTEMPTS; attempt += 1) {
      // Verified: GET /api/v1/reports/{id}; status pending/ready/errored,
      // has-match boolean. Persona warns the enumeration may grow without
      // versioning, so anything outside the three known states is
      // unavailable, not guessable.
      const res = await this.http(`${this.credentials.baseUrl}/reports/${reportId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.credentials.apiKey}` },
        body: '',
      });
      if (!res.ok) {
        throw new ScreeningUnavailableError(`Persona refused a report read (status ${res.status})`);
      }
      const body = (await res.json()) as { data?: { attributes?: Record<string, unknown> } };
      const attributes = body.data?.attributes;
      const status = attributes?.['status'];
      if (status === 'ready') {
        // has-match is the documented boolean; anything else in its place
        // (including absent) is a shape change, and a shape change in a
        // match field defaults to hit — the direction that denies.
        const result: WatchlistResult = attributes?.['has-match'] === false ? 'clean' : 'hit';
        return { result, screenedAt: new Date() };
      }
      if (status !== 'pending') {
        throw new ScreeningUnavailableError(
          `Persona report in unrecognised status: ${JSON.stringify(status)}`,
        );
      }
      await sleep(RESCREEN_POLL_MS);
    }
    throw new ScreeningUnavailableError('Persona report still pending after bounded wait: screening unavailable');
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    // Verified: `t=<unix>,v1=<hex hmac of "<t>.<raw body>">`, SHA256 hex.
    // During secret rotation the header carries two space-separated pairs;
    // either may verify. Timestamps and tolerance are ours (see above).
    const pairs = signature.trim().split(/\s+/);
    for (const pair of pairs) {
      const timestamp = /^t=(\d+),v1=([0-9a-f]+)$/.exec(pair);
      if (!timestamp?.[1] || !timestamp?.[2]) continue;

      const ageSeconds = Math.floor(Date.now() / 1000) - Number(timestamp[1]);
      if (ageSeconds < 0 || ageSeconds > TIMESTAMP_TOLERANCE_SECONDS) continue;

      let expected: Buffer;
      try {
        expected = Buffer.from(timestamp[2], 'hex');
      } catch {
        continue;
      }
      const actual = createHmac('sha256', this.credentials.webhookSecret)
        .update(`${timestamp[1]}.${rawBody.toString('utf8')}`)
        .digest();
      if (expected.length === actual.length && timingSafeEqual(expected, actual)) return true;
    }
    return false;
  }

  parseWebhookEvent(body: unknown): ParsedWebhookEvent {
    // Verified: JSON:API event envelope — data.{id, type: 'event',
    // attributes.{name, payload.data.{type, id, attributes, relationships},
    // created-at, context}}. Anything else is rejected: a lenient parser
    // here is how an unknown vendor change becomes a misapplied verdict.
    if (!body || typeof body !== 'object') {
      throw new ScreeningUnavailableError('unrecognised Persona event shape: not an object');
    }
    const data = (body as Record<string, unknown>)['data'];
    if (!data || typeof data !== 'object') {
      throw new ScreeningUnavailableError('unrecognised Persona event shape: no data envelope');
    }
    const envelope = data as Record<string, unknown>;
    const attributes = envelope['attributes'];
    if (typeof envelope['id'] !== 'string' || !attributes || typeof attributes !== 'object') {
      throw new ScreeningUnavailableError('unrecognised Persona event shape: no event id or attributes');
    }
    const attrs = attributes as Record<string, unknown>;
    if (typeof attrs['name'] !== 'string') {
      throw new ScreeningUnavailableError('unrecognised Persona event shape: no event name');
    }
    const payload = attrs['payload'];
    const resource =
      payload && typeof payload === 'object'
        ? (payload as Record<string, unknown>)['data']
        : undefined;
    if (!resource || typeof resource !== 'object') {
      throw new ScreeningUnavailableError('unrecognised Persona event shape: no payload resource');
    }
    const detail = resource as Record<string, unknown>;
    if (typeof detail['id'] !== 'string' || typeof detail['type'] !== 'string') {
      throw new ScreeningUnavailableError('unrecognised Persona event shape: payload without type and id');
    }

    const occurredAt =
      typeof attrs['created-at'] === 'string' && !Number.isNaN(Date.parse(attrs['created-at']))
        ? new Date(attrs['created-at'])
        : new Date();
    const eventId = envelope['id'] as string;
    const name = attrs['name'] as string;

    // The reference rides on the inquiry object when the event carries one
    // (verified location); report events carry the inquiry through
    // relationships instead, and `included` may hold its attributes.
    // Absent everywhere means unbindable by reference — the service then
    // falls back to the inquiry-id reverse lookup, not to guessing.
    const referenceId = this.referenceFrom(detail, attrs);

    const verdict = INQUIRY_VERDICTS[name];
    if (verdict) {
      const inquiryId = detail['type'] === 'inquiry' ? (detail['id'] as string) : '';
      if (!inquiryId) {
        throw new ScreeningUnavailableError(`Persona ${name} event without an inquiry payload`);
      }
      return {
        eventId,
        inquiryId,
        referenceId,
        occurredAt,
        decision: { verdict, watchlist: null, codes: [name], occurredAt },
      };
    }

    if (name === 'report/watchlist.matched') {
      return {
        eventId,
        inquiryId: this.inquiryLink(detail, name),
        referenceId,
        occurredAt,
        decision: { verdict: null, watchlist: 'hit', codes: [name], occurredAt },
      };
    }

    if (name === 'report/watchlist.ready') {
      const reportAttrs = (detail['attributes'] ?? {}) as Record<string, unknown>;
      // has-match false is the only clean signal. Anything else — true,
      // missing, or a shape change — is a hit: the direction that denies.
      const clean = reportAttrs['has-match'] === false;
      return {
        eventId,
        inquiryId: this.inquiryLink(detail, name),
        referenceId,
        occurredAt,
        decision: { verdict: null, watchlist: clean ? 'clean' : 'hit', codes: [name], occurredAt },
      };
    }

    // Dismissed, errored, lifecycle noise (created/expired/completed) and
    // any future name Persona adds without versioning: acknowledged and
    // named in codes, applied to nothing. The service audits the notable
    // ones (dismissed) and the watermark still moves.
    return {
      eventId,
      inquiryId: this.inquiryLink(detail, name, true) ?? '',
      referenceId,
      occurredAt,
      decision: { verdict: null, watchlist: null, codes: [name], occurredAt },
    };
  }

  private referenceFrom(detail: Record<string, unknown>, attrs: Record<string, unknown>): string | null {
    const inline = (detail['attributes'] ?? {}) as Record<string, unknown>;
    if (typeof inline['reference-id'] === 'string') return inline['reference-id'];
    const included = attrs['included'];
    if (Array.isArray(included)) {
      for (const item of included) {
        if (!item || typeof item !== 'object') continue;
        const entry = item as Record<string, unknown>;
        if (entry['type'] !== 'inquiry' || entry['id'] !== detail['id']) continue;
        const entryAttrs = (entry['attributes'] ?? {}) as Record<string, unknown>;
        if (typeof entryAttrs['reference-id'] === 'string') return entryAttrs['reference-id'];
      }
    }
    return null;
  }

  private inquiryLink(detail: Record<string, unknown>, name: string, optional = false): string {
    // Verified: a watchlist report links its inquiry through
    // relationships.inquiry.data.
    const relationships = (detail['relationships'] ?? {}) as Record<string, unknown>;
    const link = relationships['inquiry'];
    const id =
      link && typeof link === 'object'
        ? ((link as Record<string, unknown>)['data'] as Record<string, unknown> | undefined)?.['id']
        : undefined;
    if (typeof id !== 'string' || id.length === 0) {
      if (optional) return '';
      throw new ScreeningUnavailableError(`Persona ${name} event without an inquiry link`);
    }
    return id;
  }
}
