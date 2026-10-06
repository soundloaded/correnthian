import { redirect } from 'next/navigation';
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
  if (!session) redirect('/login');

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
