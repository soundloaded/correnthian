'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Boxes, Coins, Database, FileClock, Landmark, LayoutDashboard, Network, Smartphone,
  type LucideIcon,
} from 'lucide-react';
import {
  SidebarGroup, SidebarGroupLabel, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from '@/components/ui/sidebar';

export const MAIN_NAV: Array<{
  title: string; url: string; icon: LucideIcon; badge?: string;
}> = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Users', url: '/users', icon: Database },
  { title: 'Assets', url: '/assets', icon: Boxes },
  { title: 'Issuers', url: '/issuers', icon: Landmark },
  { title: 'Devices', url: '/devices', icon: Smartphone },
  { title: 'Chains', url: '/chains', icon: Network },
  { title: 'Providers', url: '/providers', icon: Coins },
  { title: 'Quotes', url: '/quotes', icon: Coins },
  { title: 'Audit log', url: '/audit', icon: FileClock, badge: 'compliance' },
];

export function NavMain() {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Operations</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {MAIN_NAV.map((item) => {
            const active = pathname === item.url || pathname.startsWith(`${item.url}/`);
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                  <Link href={item.url}>
                    <item.icon aria-hidden />
                    <span>{item.title}</span>
                    {item.badge ? (
                      <span className="ml-auto font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                        {item.badge}
                      </span>
                    ) : null}
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
