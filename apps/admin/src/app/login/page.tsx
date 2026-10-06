import { redirect } from 'next/navigation';
import { LoginForm } from './login-form';
import { getSession } from '@/lib/session';

export const metadata = { title: 'Sign in · Correnthian admin' };

export default async function LoginPage() {
  if (await getSession()) redirect('/dashboard');

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <LoginForm />
    </main>
  );
}
