import 'server-only';
import { describeApiError } from './api-error';
import { getToken } from './session';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

/**
 * Distinct outcomes, because the UI must react differently to each:
 *
 *  - `ok`                the request succeeded
 *  - `unauthorised`      no or expired session -> send to /login
 *  - `forbidden`         role too low          -> show why, do not retry
 *  - `unavailable`       API or network down   -> offer retry
 *  - `error`             anything else, with a safe message
 *
 * Collapsing these into one "failed" state is how an admin ends up showing a
 * login screen during an outage and locking everyone out.
 */
export type ApiResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'unauthorised' }
  | { status: 'forbidden'; message: string }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string; code?: string };

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<ApiResult<T>> {
  const { auth = true, ...rest } = init;
  const token = auth ? await getToken() : null;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(rest.headers ?? {}),
      },
      cache: 'no-store',
    });
  } catch {
    return {
      status: 'unavailable',
      message: 'Cannot reach the Correnthian API. It may be starting, or stopped.',
    };
  }

  if (response.status === 401) return { status: 'unauthorised' };
  if (response.status === 403) return { status: 'forbidden', message: 'Your role does not permit this action.' };
  if (response.status === 451) {
    const body = await safeJson<{ error?: { message?: string } }>(response);
    return { status: 'forbidden', message: body?.error?.message ?? 'Not permitted in this jurisdiction.' };
  }

  if (!response.ok) {
    const body = await safeJson<{ error?: { message?: string; code?: string } }>(response);
    return {
      status: response.status >= 500 ? 'unavailable' : 'error',
      message: describeApiError(body, response.status),
      code: body?.error?.code,
    };
  }

  return { status: 'ok', data: (await response.json()) as T };
}

async function safeJson<T>(r: Response): Promise<T | null> {
  try {
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

/**
 * A state-changing call.
 *
 * Separate from `apiFetch` so the distinction is impossible to miss at the call
 * site: reads and writes take the same failure vocabulary but only writes
 * carry a `detail` explaining what was refused.
 */
export async function apiSend<T>(
  path: string,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  body?: unknown,
): Promise<ApiResult<T>> {
  const token = await getToken();
  if (!token) return { status: 'unauthorised' };

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    return {
      status: 'unavailable',
      message: 'Cannot reach the Correnthian API. The change was not applied.',
    };
  }

  if (response.status === 401) return { status: 'unauthorised' };
  if (response.status === 403) {
    const payload = await safeJson<{ error?: { message?: string } }>(response);
    return {
      status: 'forbidden',
      message: payload?.error?.message ?? 'Your role does not permit this action.',
    };
  }

  if (!response.ok) {
    const payload = await safeJson<{ error?: { message?: string; code?: string; detail?: unknown } }>(response);
    return {
      status: response.status >= 500 ? 'unavailable' : 'error',
      message: describeApiError(payload, response.status),
      code: payload?.error?.code,
    };
  }

  if (response.status === 204) return { status: 'ok', data: undefined as T };
  return { status: 'ok', data: (await response.json()) as T };
}

// The rank table and `roleAtLeast` moved to `lib/roles.ts`. They are pure, and
// this module is `server-only`, which kept them out of any isolated test.
