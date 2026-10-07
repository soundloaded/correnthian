import { redirect } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { logoutAction } from '@/app/(dashboard)/actions';
import { canAccessConsole } from '@/lib/roles';
import { getSession } from '@/lib/session';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export const metadata = { title: 'No access · Correnthian admin' };

/**
 * Where a customer account lands instead of the console shell.
 *
 * This is not a security boundary — the API refuses the same account on every
 * call whatever this page does, and the role it reads comes from an unsigned
 * cookie. It exists so the console *states* the restriction, rather than
 * rendering an operations shell whose every panel comes back empty.
 *
 * The two redirects are what keep `/login` (which sends any session to
 * `/dashboard`) and this page from bouncing between each other.
 */
export default async function UnauthorizedPage() {
  const session = await getSession();
  if (!session) return redirect('/login');
  if (canAccessConsole(session.role)) return redirect('/dashboard');

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="size-4 shrink-0 text-destructive" aria-hidden />
            No access to this console
          </CardTitle>
          <CardDescription>
            Signed in as {session.email} ({session.role}).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The operations console is for Correnthian staff. Your account is a
            customer account: it holds metal, it does not operate the registry.
            Your holdings and balances are unaffected.
          </p>
          <p className="text-sm text-muted-foreground">
            If you believe this is wrong, ask an administrator to change your
            role — it is not something you can grant yourself.
          </p>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" className="w-full">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
