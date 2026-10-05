'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { clearSession, getSession } from '@/lib/session';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

/** Revoke server-side when possible, then drop the cookie regardless. */
export async function logoutAction(): Promise<void> {
  const response = await fetch(`${API_URL}/auth/logout`, {
    method: 'POST',
    cache: 'no-store',
  }).catch(() => null);

  if (response && !response.ok) {
    // The token may already be dead server-side. The local cookie must still
    // go, or the operator is stuck on a session the API has forgotten.
  }

  await clearSession();
  redirect('/login');
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}

export async function changeRoleAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (session.role !== 'admin' && session.role !== 'owner') redirect('/users');

  const userId = String(formData.get('userId') ?? '');
  const role = String(formData.get('role') ?? '');

  await fetch(`${API_URL}/users/${userId}/role`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await cookieToken()}`,
    },
    body: JSON.stringify({ role }),
    cache: 'no-store',
  }).catch(() => null);

  revalidatePath('/users');
}

async function cookieToken(): Promise<string> {
  const { getToken } = await import('@/lib/session');
  return (await getToken()) ?? '';
}
