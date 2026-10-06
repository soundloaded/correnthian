import 'server-only';
import { cookies } from 'next/headers';

/**
 * The API issues bearer tokens. They are kept in an httpOnly cookie rather
 * than localStorage so that an XSS in this admin cannot read them — a stolen
 * admin token grants access to every account, KYC record and audit entry.
 */
const COOKIE = 'correnthian_admin_session';
const MAX_AGE_SECONDS = 60 * 60 * 12;

export interface AdminSession {
  userId: string;
  email: string;
  role: string;
}

export async function getToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE)?.value ?? null;
}

export async function getSession(): Promise<AdminSession | null> {
  const token = await getToken();
  if (!token) return null;
  // The session payload is the signed-in identity only. Authorisation is
  // re-checked server-side on every call — this is display state, never a
  // security decision.
  const jar = await cookies();
  const raw = jar.get(`${COOKIE}_user`)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString()) as AdminSession;
  } catch {
    return null;
  }
}

export async function setSession(token: string, session: AdminSession): Promise<void> {
  const jar = await cookies();
  const secure = process.env.NODE_ENV === 'production';

  jar.set(COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
  jar.set(`${COOKIE}_user`, Buffer.from(JSON.stringify(session)).toString('base64url'), {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
  jar.delete(`${COOKIE}_user`);
}
