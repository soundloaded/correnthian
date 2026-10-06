'use server';

import { redirect } from 'next/navigation';
import { setSession } from '@/lib/session';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export interface LoginState {
  error?: string;
}

/**
 * Authenticates against the API and stores the bearer token in an httpOnly
 * cookie. The token is never returned to the browser.
 */
export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Enter both an email address and a password.' };
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });
  } catch {
    return {
      error: 'Cannot reach the Correnthian API. Check that it is running, then try again.',
    };
  }

  if (response.status === 401) {
    // Deliberately vague: this form must not confirm which addresses exist.
    return { error: 'Those credentials were not accepted.' };
  }
  if (!response.ok) {
    return { error: `Sign-in failed (${response.status}). Try again.` };
  }

  const body = (await response.json()) as {
    token: string;
    user: { id: string; email: string; role: string };
  };

  await setSession(body.token, {
    userId: body.user.id,
    email: body.user.email,
    role: body.user.role,
  });

  redirect('/dashboard');
}
