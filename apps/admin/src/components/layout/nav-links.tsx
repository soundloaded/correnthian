'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Boxes, Coins, Database, FileClock, Landmark, LayoutDashboard,
  Network, Smartphone, type LucideIcon,
} from 'lucide-react';
import {
  SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from '@/components/ui/sidebar';

/**
 * Flat navigation, deliberately.
 *
 * sidebar-08 shipped collapsible sub-groups. They were dropped: an operator
 * console has a dozen destinations, all one level deep, and making people
 * expand a section to find a page is friction for no gain. If a group ever
 * genuinely needs nesting, add it where it exists rather than everywhere by
 * default.
 */
const NAV: Array<{ title: string; href: string; icon: LucideIcon }> = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Users', href: '/users', icon: Database },
  { title: 'Devices', href: '/devices', icon: Smartphone },
  { title: 'Assets', href: '/assets', icon: Boxes },
  { title: 'Issuers', href: '/issuers', icon: Landmark },
  { title: 'Chains', href: '/chains', icon: Network },
  { title: 'Providers', href: '/providers', icon: Coins },
  { title: 'Quotes', href: '/quotes', icon: Coins },
  { title: 'Redemptions', href: '/redemptions', icon: Landmark },
  { title: 'Reviews', href: '/reviews', icon: FileClock },
  { title: 'Audit log', href: '/audit', icon: FileClock },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Operations</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {NAV.map(({ title, href, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <SidebarMenuItem key={href}>
                <SidebarMenuButton asChild isActive={active} tooltip={title}>
                  <Link href={href}>
                    <Icon aria-hidden />
                    <span>{title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
