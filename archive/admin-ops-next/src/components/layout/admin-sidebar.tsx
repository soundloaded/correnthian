'use client';

import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail,
} from '@/components/ui/sidebar';
import { NavLinks } from './nav-links';
import { UserMenu } from './user-menu';

/**
 * The inset layout from sidebar-08, kept because it reads as a distinct
 * surface against the content area rather than competing with it.
 */
export function AdminSidebar({
  session,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  session: { email: string; role: string } | null;
}) {
  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <ShieldCheck className="size-4" aria-hidden />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-medium">Correnthian</span>
                  <span className="truncate text-xs text-muted-foreground">Admin</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavLinks />
      </SidebarContent>

      <SidebarFooter>
        <UserMenu session={session} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
