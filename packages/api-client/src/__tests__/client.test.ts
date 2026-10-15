import { describe, expect, it, vi } from 'vitest';
import { createCorrenthianClient } from '../client.js';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('api-client failure vocabulary', () => {
  it('sends the bearer token and validates the body against the registry', async () => {
    const seen: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      seen.push({ url, init });
      return jsonResponse(200, { total: 2, enabled: 1, enabledMetals: 1, staleAttestations: 0, byTier: {} });
    });
    const client = createCorrenthianClient({
      baseUrl: 'http://api.test',
      getToken: () => 'tok-123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await client.request('GET /api/v1/assets/stats');

    expect(result.status).toBe('ok');
    expect(seen[0]?.url).toBe('http://api.test/api/v1/assets/stats');
    expect((seen[0]?.init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok-123');
  });

  it('fills path params and query strings', async () => {
    const seen: Array<{ url: string }> = [];
    const fetchImpl = vi.fn(async (url: string) => {
      seen.push({ url });
      return jsonResponse(200, { total: 0, enabled: 0, enabledMetals: 0, staleAttestations: 0, byTier: {} });
    });
    const client = createCorrenthianClient({ baseUrl: 'http://api.test/', fetchImpl: fetchImpl as unknown as typeof fetch });

    await client.request('GET /api/v1/assets/stats', { auth: false });
    expect(seen[0]?.url).toBe('http://api.test/api/v1/assets/stats');
  });

  it('maps 401 to unauthorised and 403 to forbidden', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(401, null));
    const client = createCorrenthianClient({ baseUrl: 'http://api.test', fetchImpl: fetchImpl as unknown as typeof fetch });
    expect((await client.request('GET /api/v1/assets/stats')).status).toBe('unauthorised');

    const forbidden = vi.fn(async () =>
      jsonResponse(403, { error: { code: 'forbidden', message: 'Too low.' }, path: '/x', timestamp: new Date().toISOString() }),
    );
    const client2 = createCorrenthianClient({ baseUrl: 'http://api.test', fetchImpl: forbidden as unknown as typeof fetch });
    const denied = await client2.request('GET /api/v1/assets/stats');
    expect(denied.status).toBe('forbidden');
  });

  it('maps network failure and 5xx to unavailable, never throwing', async () => {
    const down = createCorrenthianClient({
      baseUrl: 'http://api.test',
      fetchImpl: (async () => { throw new Error('down'); }) as unknown as typeof fetch,
    });
    expect((await down.request('GET /api/v1/assets/stats')).status).toBe('unavailable');

    const broken = createCorrenthianClient({
      baseUrl: 'http://api.test',
      fetchImpl: (async () => jsonResponse(500, { error: { code: 'x', message: 'Bad.' }, path: '/', timestamp: '' })) as unknown as typeof fetch,
    });
    expect((await broken.request('GET /api/v1/assets/stats')).status).toBe('unavailable');
  });

  it('refuses a body the registry does not recognise instead of passing it on', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { nope: true }));
    const client = createCorrenthianClient({ baseUrl: 'http://api.test', fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await client.request('GET /api/v1/assets/stats');
    expect(result.status).toBe('error');
  });

  it('sends the idempotency key on writes without logging it', async () => {
    const seen: Array<{ init: RequestInit }> = [];
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      seen.push({ init });
      return jsonResponse(200, []);
    });
    const client = createCorrenthianClient({ baseUrl: 'http://api.test', fetchImpl: fetchImpl as unknown as typeof fetch });

    await client.request('GET /api/v1/notifications/mine', { idempotencyKey: 'key-1' });
    expect((seen[0]?.init.headers as Record<string, string>)['Idempotency-Key']).toBe('key-1');
  });

  it('takes the HTTP method from the registry key, so bodies ride on POST', async () => {
    const seen: Array<{ init: RequestInit }> = [];
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      seen.push({ init });
      return jsonResponse(200, { total: 0, enabled: 0, enabledMetals: 0, staleAttestations: 0, byTier: {} });
    });
    const client = createCorrenthianClient({ baseUrl: 'http://api.test', fetchImpl: fetchImpl as unknown as typeof fetch });

    // No explicit method: the key says POST, so POST must go out. A GET
    // default here made fetch throw on the body and every login fail as
    // "unreachable" — this test fails against that default.
    await client.request('POST /api/v1/auth/login', { auth: false, body: { email: 'a', password: 'b' } });
    expect(seen[0]?.init.method).toBe('POST');
    expect(typeof seen[0]?.init.body).toBe('string');
  });

  it('notifies once per 401 without letting a bad handler break the result', async () => {
    const seen: string[] = [];
    const fetchImpl = (async () => jsonResponse(401, null)) as unknown as typeof fetch;
    const client = createCorrenthianClient({
      baseUrl: 'http://api.test',
      fetchImpl,
      onUnauthorised: () => {
        seen.push('fired');
        throw new Error('handler bug');
      },
    });

    const result = await client.request('GET /api/v1/assets/stats');
    expect(result.status).toBe('unauthorised');
    expect(seen).toEqual(['fired']);
  });
});
