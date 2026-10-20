import { CONTRACT_REGISTRY, type Contract } from '@correnthian/contracts';

export type ApiResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'unauthorised' }
  | { status: 'forbidden'; message: string }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string; code?: string };

export type RegistryPath = Extract<keyof typeof CONTRACT_REGISTRY, string>;

export interface ClientOptions {
  baseUrl: string;
  getToken?: () => string | null | Promise<string | null>;
  fetchImpl?: typeof fetch;
  /**
   * Fired once per 401 response, outside the result flow. Screens use it for
   * the one global action a dead session demands — drop the session and
   * leave. Never throws into the request: a handler bug must not convert
   * every 401 into a crash.
   */
  onUnauthorised?: () => void;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  params?: Record<string, string | number>;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  idempotencyKey?: string;
  auth?: boolean;
}

function fillParams(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  let out = template;
  for (const [key, value] of Object.entries(params)) {
    out = out.replace(`:${key}`, encodeURIComponent(String(value)));
  }
  return out;
}

function buildUrl(baseUrl: string, path: string, query?: RequestOptions['query']): string {
  const base = baseUrl.replace(/\/$/, '');
  if (!query) return `${base}${path}`;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) search.set(key, String(value));
  }
  const suffix = search.toString();
  return suffix ? `${base}${path}?${suffix}` : `${base}${path}`;
}

interface ErrorBody {
  error?: { message?: string; code?: string };
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function errorMessage(body: unknown, fallback: string): { message: string; code?: string } {
  if (body && typeof body === 'object' && 'error' in body) {
    const err = (body as ErrorBody).error;
    if (err && typeof err.message === 'string') {
      return typeof err.code === 'string' ? { message: err.message, code: err.code } : { message: err.message };
    }
  }
  return { message: fallback };
}

export function createCorrenthianClient(options: ClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;

  async function request<Path extends RegistryPath>(
    key: Path,
    reqOptions: RequestOptions = {},
  ): Promise<ApiResult<Contract<Path>>> {
    const space = key.indexOf(' ');
    if (space <= 0) {
      throw new Error(`Malformed contract key (no METHOD prefix): ${key}`);
    }
    // The HTTP method lives in the registry key ("POST /api/v1/..."), not in
    // the options: a caller that could send a body with a GET default would
    // make fetch throw (GET/HEAD cannot carry a body) and every financial
    // POST would arrive as a GET. An explicit option still wins.
    const { method = key.slice(0, space) as NonNullable<RequestOptions['method']>, params, query, body, idempotencyKey, auth = true } = reqOptions;
    const template = key.slice(space + 1);
    // `query` belongs in the URL. It was destructured here and then dropped on
    // the floor: the URL was built from path params alone, so every list
    // filter, sort, limit and pagination cursor the console sent never
    // reached the API. The server answered with its defaults, and the
    // console looked like a filter that did nothing.
    const url = buildUrl(options.baseUrl, fillParams(template, params), query);

    let token: string | null = null;
    if (auth && options.getToken) token = await options.getToken();

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

    let response: Response;
    try {
      response = await fetchImpl(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      return { status: 'unavailable', message: 'Cannot reach the Correnthian API. It may be starting, or stopped.' };
    }

    if (response.status === 401) {
      // Unauthenticated calls (sign-in itself) must not trip the global
      // sign-out: a 401 there is the answer, not a dead session. Firing
      // here reloaded the page and swallowed the form's own error state.
      if (auth && options.onUnauthorised) {
        try {
          options.onUnauthorised();
        } catch {
          // Handlers are observers, never participants.
        }
      }
      return { status: 'unauthorised' };
    }
    if (response.status === 403 || response.status === 451) {
      const parsed = errorMessage(await safeJson(response), 'Not permitted.');
      return { status: 'forbidden', message: parsed.message };
    }
    if (!response.ok) {
      const parsed = errorMessage(await safeJson(response), `Request failed (${response.status})`);
      if (response.status >= 500) {
        return { status: 'unavailable', message: parsed.message, ...(parsed.code ? { code: parsed.code } : {}) };
      }
      return { status: 'error', message: parsed.message, ...(parsed.code ? { code: parsed.code } : {}) };
    }
    if (response.status === 204) return { status: 'ok', data: undefined as Contract<Path> };

    const json = await safeJson(response);
    const schema = (CONTRACT_REGISTRY as Record<string, { safeParse: (v: unknown) => { success: boolean; data?: unknown } }>)[key as string];
    if (schema) {
      const checked = schema.safeParse(json);
      if (!checked.success) {
        return { status: 'error', message: 'The API answered in a shape this client does not recognise.', code: 'contract_mismatch' };
      }
      return { status: 'ok', data: checked.data as Contract<Path> };
    }
    return { status: 'ok', data: json as Contract<Path> };
  }

  return { request };
}

export type CorrenthianClient = ReturnType<typeof createCorrenthianClient>;
