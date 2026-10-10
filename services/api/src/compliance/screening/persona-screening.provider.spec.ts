import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { PersonaScreeningProvider } from './persona-screening.provider.js';

/**
 * The Persona adapter, against stubbed HTTP.
 *
 * Every literal from Persona's side — the `persona-signature` header shape,
 * the `t=`/`v1=` parts, the event envelope — is an assumption until checked
 * against their docs (the docs MCP was unavailable when this was written).
 * They are marked VERIFY-AGAINST-DOCS in the implementation, and this spec
 * pins the *implemented* shape so a correction there breaks loudly here
 * rather than drifting silently.
 *
 * What is NOT an assumption and IS pinned here: unsigned bytes never verify,
 * an unknown event shape is rejected rather than guessed at, and the adapter
 * never throws the vendor's raw body at a caller — errors carry the event id
 * and a reason, never PII.
 */
const SECRET = 'whsec_test_123';

function signedBody(body: string, atSeconds = Math.floor(Date.now() / 1000)): { raw: Buffer; header: string } {
  const raw = Buffer.from(body, 'utf8');
  const sig = createHmac('sha256', SECRET).update(`${atSeconds}.${body}`).digest('hex');
  return { raw, header: `t=${atSeconds},v1=${sig}` };
}

function adapterWith(fetchFn: (url: string, init: { method: string; body: string }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>) {
  return new PersonaScreeningProvider(
    { apiKey: 'key_test', webhookSecret: SECRET, baseUrl: 'https://fake.test/api/v1' },
    fetchFn as never,
  );
}

describe('PersonaScreeningProvider webhooks', () => {
  it('verifies a signature it produced itself', () => {
    const adapter = adapterWith(async () => { throw new Error('no HTTP in this test'); });
    const { raw, header } = signedBody('{"id":"evt_1"}');
    expect(adapter.verifyWebhookSignature(raw, header)).toBe(true);
  });

  it('rejects bytes signed with a different secret', () => {
    const adapter = adapterWith(async () => { throw new Error('no HTTP in this test'); });
    const raw = Buffer.from('{"id":"evt_1"}', 'utf8');
    const sig = createHmac('sha256', 'wrong-secret').update(`${Math.floor(Date.now() / 1000)}.{"id":"evt_1"}`).digest('hex');
    expect(adapter.verifyWebhookSignature(raw, `t=${Math.floor(Date.now() / 1000)},v1=${sig}`)).toBe(false);
  });

  it('rejects a tampered body under a valid header', () => {
    const adapter = adapterWith(async () => { throw new Error('no HTTP in this test'); });
    const { header } = signedBody('{"id":"evt_1"}');
    expect(adapter.verifyWebhookSignature(Buffer.from('{"id":"evt_2"}', 'utf8'), header)).toBe(false);
  });

  it('rejects a stale timestamp rather than replaying it forever', () => {
    const adapter = adapterWith(async () => { throw new Error('no HTTP in this test'); });
    const { raw, header } = signedBody('{"id":"evt_1"}', Math.floor(Date.now() / 1000) - 3600);
    expect(adapter.verifyWebhookSignature(raw, header)).toBe(false);
  });

  it('rejects a malformed header without throwing', () => {
    const adapter = adapterWith(async () => { throw new Error('no HTTP in this test'); });
    expect(adapter.verifyWebhookSignature(Buffer.from('{}', 'utf8'), 'not-a-signature')).toBe(false);
    expect(adapter.verifyWebhookSignature(Buffer.from('{}', 'utf8'), '')).toBe(false);
  });

  it('parses a decision event into reference, inquiry and verdict', () => {
    const adapter = adapterWith(async () => { throw new Error('no HTTP in this test'); });
    const event = adapter.parseWebhookEvent({
      id: 'evt_123',
      type: 'inquiry.passed',
      created_at: new Date().toISOString(),
      data: { id: 'inq_456', reference_id: 'user_789', status: 'passed', watchlist: 'clear' },
    });
    expect(event).toMatchObject({
      eventId: 'evt_123',
      inquiryId: 'inq_456',
      referenceId: 'user_789',
    });
    expect(event.decision).toMatchObject({ verdict: 'passed', watchlist: 'clean' });
    expect(event.occurredAt).toBeInstanceOf(Date);
  });

  it('rejects an event shape it does not recognise, rather than guessing', () => {
    const adapter = adapterWith(async () => { throw new Error('no HTTP in this test'); });
    expect(() => adapter.parseWebhookEvent({ id: 'evt_1' })).toThrow(/unrecognised/i);
    expect(() => adapter.parseWebhookEvent(null)).toThrow(/unrecognised/i);
    expect(() => adapter.parseWebhookEvent('string')).toThrow(/unrecognised/i);
  });
});

describe('PersonaScreeningProvider inquiries', () => {
  it('creates an inquiry keyed to our user id and returns the session token', async () => {
    const seen: Array<{ url: string; body: string }> = [];
    const adapter = adapterWith(async (url, init) => {
      seen.push({ url, body: init.body });
      return {
        ok: true,
        status: 201,
        json: async () => ({ data: { id: 'inq_999', session_token: 'sess_abc' } }),
      };
    });

    const out = await adapter.createInquiry('user_123');
    expect(out).toEqual({ inquiryId: 'inq_999', sessionToken: 'sess_abc' });
    expect(seen).toHaveLength(1);
    // Our user id travels as the reference, so the webhook can bind back.
    expect(seen[0]?.body).toContain('user_123');
    expect(seen[0]?.url).toContain('https://fake.test/api/v1');
  });

  it('surfaces a vendor refusal without the response body', async () => {
    const adapter = adapterWith(async () => ({ ok: false, status: 422, json: async () => ({ errors: [{ detail: 'PII leaked here' }] }) }));
    await expect(adapter.createInquiry('user_123')).rejects.toThrow(/persona refused/i);
    await adapter.createInquiry('user_123').catch((err: Error) => {
      // The vendor's error payload stays vendor-side. A 422 detail string is
      // exactly the shape that carries request echoes.
      expect(err.message).not.toContain('PII leaked here');
    });
  });

  it('asks, never assumes, when rescreening', async () => {
    const adapter = adapterWith(async (url) => {
      expect(url).toContain('user_123');
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { result: 'consider', screened_at: new Date().toISOString() } }),
      };
    });
    const out = await adapter.rescreen('user_123');
    expect(out.result).toBe('hit');
    expect(out.screenedAt).toBeInstanceOf(Date);
  });
});
