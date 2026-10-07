import { redirect } from 'next/navigation';
import { canAccessConsole } from '@/lib/roles';
import { getSession } from '@/lib/session';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { SiteHeader } from '@/components/layout/site-header';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

/**
 * Every route in this group requires a session. The guard lives here rather
 * than in each page so a new page cannot be added without protection.
 */
export default async function DashboardLayout({ children }: LayoutProps<'/'>) {
  const session = await getSession();
  if (!session) return redirect('/login');

  // Defence in depth behind the check at sign-in: a session outlives a role
  // change, and the cookie that carries the role is display state only. This
  // decides which shell to render — the API still authorises every call.
  //
  // `return` rather than a bare call: Next's `redirect` halts by throwing, and
  // a guard that depends on that is a guard that silently stops guarding the
  // moment it is called from somewhere that does not.
  if (!canAccessConsole(session.role)) return redirect('/unauthorized');

  return (
    <SidebarProvider>
      <AdminSidebar session={session} />
      <SidebarInset>
        <SiteHeader />
        <Separator />
        <main className="flex flex-1 flex-col gap-6 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
