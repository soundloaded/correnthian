import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PersonaScreeningProvider } from './persona-screening.provider.js';

/**
 * The Persona adapter, against stubbed HTTP — shapes verified against the
 * docs 2026-10-10 (api.withpersona.com host, JSON:API envelopes, real event
 * names). Anything still marked VERIFY-AGAINST-DOCS in the implementation
 * is a residual: the inquiry-approval payload's exact attribute layout
 * (inferred from the event-envelope example, not seen verbatim) and the
 * reference-id's presence on inline inquiry objects.
 *
 * What is NOT an assumption and IS pinned here: unsigned bytes never verify,
 * an unknown event shape is rejected rather than guessed at, the vendor's
 * error bodies never reach a caller, and re-screening links the report to
 * the inquiry it belongs to.
 */
const SECRET = 'whsec_test_123';
const CREDS = {
  apiKey: 'key_test',
  webhookSecret: SECRET,
  baseUrl: 'https://fake.test/api/v1',
  templateId: 'itmpl_test',
};

type HttpResponse = { ok: boolean; status: number; json: () => Promise<unknown> };

function adapterWith(
  fetchFn: (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<HttpResponse>,
) {
  return new PersonaScreeningProvider(CREDS, fetchFn as never);
}

function signedBody(body: string, atSeconds = Math.floor(Date.now() / 1000)): { raw: Buffer; header: string } {
  const raw = Buffer.from(body, 'utf8');
  const sig = createHmac('sha256', SECRET).update(`${atSeconds}.${body}`).digest('hex');
  return { raw, header: `t=${atSeconds},v1=${sig}` };
}

/** A JSON:API event envelope, per the retrieve-an-event example. */
function envelope(name: string, payloadData: Record<string, unknown>, eventId = 'evt_123'): Record<string, unknown> {
  return {
    data: {
      id: eventId,
      type: 'event',
      attributes: {
        name,
        payload: { data: payloadData },
        'created-at': new Date().toISOString(),
        context: {},
      },
    },
  };
}

const inquiryPayload = (over: Record<string, unknown> = {}) => ({
  type: 'inquiry',
  id: 'inq_456',
  attributes: { status: 'approved', 'reference-id': 'user_789', ...over },
  relationships: {},
});

describe('PersonaScreeningProvider webhooks', () => {
  it('verifies a signature it produced itself', () => {
    const adapter = adapterWith(async () => { throw new Error('no HTTP in this test'); });
    const { raw, header } = signedBody('{"data":{"id":"evt_1"}}');
    expect(adapter.verifyWebhookSignature(raw, header)).toBe(true);
  });

  it('accepts the second pair during secret rotation', () => {
    // Per the docs the header carries two space-separated pairs while a
    // secret rotates. Rejecting the second would drop every event signed
    // with the new secret for the rotation window.
    const adapter = adapterWith(async () => { throw new Error('no HTTP in this test'); });
    const body = '{"data":{"id":"evt_1"}}';
    const at = Math.floor(Date.now() / 1000);
    const oldSig = createHmac('sha256', 'old-secret').update(`${at}.${body}`).digest('hex');
    const { header: newHeader } = signedBody(body, at);
    const combined = `t=${at},v1=${oldSig} ${newHeader}`;
    expect(adapter.verifyWebhookSignature(Buffer.from(body, 'utf8'), combined)).toBe(true);
  });

  it('rejects bytes signed with a different secret', () => {
    const adapter = adapterWith(async () => { throw new Error('no HTTP in this test'); });
    const at = Math.floor(Date.now() / 1000);
    const raw = Buffer.from('{"data":{"id":"evt_1"}}', 'utf8');
    const sig = createHmac('sha256', 'wrong-secret').update(`${at}.{"data":{"id":"evt_1"}}`).digest('hex');
    expect(adapter.verifyWebhookSignature(raw, `t=${at},v1=${sig}`)).toBe(false);
  });

  it('rejects a tampered body under a valid header', () => {
    const adapter = adapterWith(async () => { throw new Error('no HTTP in this test'); });
    const { header } = signedBody('{"data":{"id":"evt_1"}}');
    expect(adapter.verifyWebhookSignature(Buffer.from('{"data":{"id":"evt_2"}}', 'utf8'), header)).toBe(false);
  });

  it('rejects a stale timestamp rather than replaying it forever', () => {
    // Our replay policy, not Persona's: the docs specify no tolerance, so
    // the bound lives here and is stated as ours.
    const adapter = adapterWith(async () => { throw new Error('no HTTP in this test'); });
    const { raw, header } = signedBody('{"data":{"id":"evt_1"}}', Math.floor(Date.now() / 1000) - 3600);
    expect(adapter.verifyWebhookSignature(raw, header)).toBe(false);
  });

  it('rejects a malformed header without throwing', () => {
    const adapter = adapterWith(async () => { throw new Error('no HTTP in this test'); });
    expect(adapter.verifyWebhookSignature(Buffer.from('{}', 'utf8'), 'not-a-signature')).toBe(false);
    expect(adapter.verifyWebhookSignature(Buffer.from('{}', 'utf8'), '')).toBe(false);
  });

  it('maps inquiry.approved to a verification pass with no list signal', () => {
    const adapter = adapterWith(async () => { throw new Error('no HTTP in this test'); });
    const event = adapter.parseWebhookEvent(envelope('inquiry.approved', inquiryPayload()));
    expect(event).toMatchObject({
      eventId: 'evt_123',
      inquiryId: 'inq_456',
      referenceId: 'user_789',
    });
    // Approvals carry no watchlist information: a null here is what keeps
    // an approval from doubleing as a clean screen.
    expect(event.decision).toMatchObject({ verdict: 'passed', watchlist: null });
    expect(event.occurredAt).toBeInstanceOf(Date);
  });

  it('maps declined, marked-for-review and failed to park verdicts', () => {
    const adapter = adapterWith(async () => { throw new Error('no HTTP in this test'); });
    for (const [name, verdict] of [
      ['inquiry.declined', 'declined'],
      ['inquiry.marked-for-review', 'needs_review'],
      ['inquiry.failed', 'declined'],
    ] as const) {
      const event = adapter.parseWebhookEvent(envelope(name, inquiryPayload(), `evt_${name}`));
      expect(event.decision).toMatchObject({ verdict, watchlist: null });
      expect(event.decision?.codes).toContain(name);
    }
  });

  it('maps report/watchlist.matched to a hit with the inquiry link', () => {
    const adapter = adapterWith(async () => { throw new Error('no HTTP in this test'); });
    const payload = {
      type: 'report/watchlist',
      id: 'rpt_1',
      attributes: { 'has-match': true, status: 'ready' },
      relationships: { inquiry: { data: { type: 'inquiry', id: 'inq_456' } } },
    };
    const event = adapter.parseWebhookEvent(envelope('report/watchlist.matched', payload, 'evt_wl'));
    expect(event).toMatchObject({ eventId: 'evt_wl', inquiryId: 'inq_456' });
    expect(event.decision).toMatchObject({ verdict: null, watchlist: 'hit' });
  });

  it('reads a ready report with no match as clean', () => {
    const adapter = adapterWith(async () => { throw new Error('no HTTP in this test'); });
    const payload = {
      type: 'report/watchlist',
      id: 'rpt_2',
      attributes: { 'has-match': false, status: 'ready' },
      relationships: { inquiry: { data: { type: 'inquiry', id: 'inq_456' } } },
    };
    const event = adapter.parseWebhookEvent(envelope('report/watchlist.ready', payload, 'evt_ready'));
    expect(event.decision).toMatchObject({ verdict: null, watchlist: 'clean' });
  });

  it('reads a missing match field as a hit: the direction that denies', () => {
    // A shape change in the one field that says "match" must not become a
    // clean screen by omission. Fail-closed is a property of the parser too.
    const adapter = adapterWith(async () => { throw new Error('no HTTP in this test'); });
    const payload = {
      type: 'report/watchlist',
      id: 'rpt_4',
      attributes: { status: 'ready' },
      relationships: { inquiry: { data: { type: 'inquiry', id: 'inq_456' } } },
    };
    const event = adapter.parseWebhookEvent(envelope('report/watchlist.ready', payload, 'evt_nomatch'));
    expect(event.decision).toMatchObject({ verdict: null, watchlist: 'hit' });
  });
  it('notes a dismissal without deciding: only our operator clears a latch', () => {
    const adapter = adapterWith(async () => { throw new Error('no HTTP in this test'); });
    const payload = {
      type: 'report/watchlist',
      id: 'rpt_3',
      attributes: { 'has-match': true, status: 'ready' },
      relationships: { inquiry: { data: { type: 'inquiry', id: 'inq_456' } } },
    };
    const event = adapter.parseWebhookEvent(envelope('report/watchlist.dismissed', payload, 'evt_dis'));
    expect(event.decision).toMatchObject({ verdict: null, watchlist: null });
    expect(event.decision?.codes).toContain('report/watchlist.dismissed');
  });

  it('notes unknown event names instead of breaking on them', () => {
    // Persona warns new values arrive without versioning. An unknown name
    // is acknowledged and surfaced in codes — never thrown, never applied.
    const adapter = adapterWith(async () => { throw new Error('no HTTP in this test'); });
    const event = adapter.parseWebhookEvent(envelope('inquiry.something-new', inquiryPayload(), 'evt_new'));
    expect(event.decision).toMatchObject({ verdict: null, watchlist: null });
    expect(event.decision?.codes).toContain('inquiry.something-new');
  });

  it('rejects an envelope it cannot bind rather than guessing', () => {
    const adapter = adapterWith(async () => { throw new Error('no HTTP in this test'); });
    expect(() => adapter.parseWebhookEvent({})).toThrow(/unrecognised/i);
    expect(() => adapter.parseWebhookEvent(null)).toThrow(/unrecognised/i);
    expect(() => adapter.parseWebhookEvent({ data: { id: 'evt_1' } })).toThrow(/unrecognised/i);
  });
});

describe('PersonaScreeningProvider inquiries', () => {
  it('creates an inquiry with a template and our reference, and returns the session token', async () => {
    const seen: Array<{ url: string; body: string }> = [];
    const adapter = adapterWith(async (url, init) => {
      seen.push({ url, body: init.body });
      return {
        ok: true,
        status: 201,
        json: async () => ({ data: { id: 'inq_999' }, meta: { 'session-token': 'sess_abc' } }),
      };
    });

    const out = await adapter.createInquiry('user_123');
    expect(out).toEqual({ inquiryId: 'inq_999', sessionToken: 'sess_abc' });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.url).toBe('https://fake.test/api/v1/inquiries');
    const body = JSON.parse(seen[0]?.body ?? '{}');
    // Template is required by the API; the reference binds our user.
    expect(body.data.attributes['inquiry-template-id']).toBe('itmpl_test');
    expect(body.meta['auto-create-account-reference-id']).toBe('user_123');
    expect(body.meta['auto-create-inquiry-session']).toBe(true);
  });

  it('refuses to create without a template rather than sending a known-bad call', async () => {
    const adapter = new PersonaScreeningProvider(
      { apiKey: 'key_test', webhookSecret: SECRET, baseUrl: 'https://fake.test/api/v1' },
      (async () => { throw new Error('must not be called'); }) as never,
    );
    await expect(adapter.createInquiry('user_123')).rejects.toThrow(/template/i);
  });

  it('surfaces a vendor refusal without the response body', async () => {
    const adapter = adapterWith(async () => ({
      ok: false,
      status: 422,
      json: async () => ({ errors: [{ detail: 'PII leaked here' }] }),
    }));
    await expect(adapter.createInquiry('user_123')).rejects.toThrow(/persona refused/i);
    await adapter.createInquiry('user_123').catch((err: Error) => {
      expect(err.message).not.toContain('PII leaked here');
    });
  });

  it('re-screens by linking a watchlist report to the inquiry, then reads the result', async () => {
    const seen: string[] = [];
    const adapter = adapterWith(async (url, init) => {
      seen.push(`${init.method} ${url}`);
      if (url.endsWith('/reports')) {
        return { ok: true, status: 201, json: async () => ({ data: { id: 'rpt_9' } }) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 'rpt_9', attributes: { status: 'ready', 'has-match': true } } }),
      };
    });

    const out = await adapter.rescreen('user_123', 'inq_456');
    expect(out.result).toBe('hit');
    expect(out.screenedAt).toBeInstanceOf(Date);
    expect(seen[0]).toBe('POST https://fake.test/api/v1/reports');
    expect(seen[1]).toBe('GET https://fake.test/api/v1/reports/rpt_9');
  });

  it('waits briefly for a pending report, then fails closed', async () => {
    let gets = 0;
    const adapter = adapterWith(async (url) => {
      if (url.endsWith('/reports')) {
        return { ok: true, status: 201, json: async () => ({ data: { id: 'rpt_9' } }) };
      }
      gets += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 'rpt_9', attributes: { status: 'pending' } } }),
      };
    });

    await expect(adapter.rescreen('user_123', 'inq_456')).rejects.toThrow(/not ready|unavailable/i);
    expect(gets).toBeGreaterThan(1);
  });

  it('refuses to re-screen without an inquiry to link the report to', async () => {
    const adapter = adapterWith(async () => { throw new Error('must not be called'); });
    await expect(adapter.rescreen('user_123')).rejects.toThrow(/inquiry/i);
  });
});
