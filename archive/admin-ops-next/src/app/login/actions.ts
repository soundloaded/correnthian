'use server';

import { redirect } from 'next/navigation';
import { apiUrl } from '@/lib/api-url';
import { canAccessConsole } from '@/lib/roles';
import { setSession } from '@/lib/session';

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
    response = await fetch(apiUrl('/auth/login'), {
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

  // The credentials were correct. This account is simply not staff, so no
  // session is written at all — there is then nothing for the shell to render
  // a gate against, and no cookie to strip later.
  if (!canAccessConsole(body.user.role)) {
    return { error: 'This account does not have access to the operations console.' };
  }

  await setSession(body.token, {
    userId: body.user.id,
    email: body.user.email,
    role: body.user.role,
  });

  redirect('/dashboard');
}
