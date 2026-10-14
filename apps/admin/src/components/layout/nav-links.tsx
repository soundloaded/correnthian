'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeftRight, Bell, Boxes, Clock, Globe, Landmark, LayoutDashboard,
  Link as LinkIcon, Percent, PlugZap, Receipt, ScrollText, ShieldCheck,
  Smartphone, Users, Vault, type LucideIcon,
} from 'lucide-react';
import {
  SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from '@/components/ui/sidebar';

/**
 * Flat navigation with group labels, deliberately.
 *
 * Collapsible sub-groups were dropped with the old template's nesting: an
 * operator console has sixteen destinations, all one level deep, and making
 * people expand a section to find a page is friction for no gain. Labels
 * alone scan without hiding anything.
 *
 * The raised hover/active treatment is adapted from the Nexora template's
 * nav: muted text at rest, card surface with border and shadow on hover and
 * when active, using only theme tokens so it follows the obsidian mapping.
 */
const itemClasses = [
  'border border-transparent',
  'bg-transparent shadow-none',
  'text-muted-foreground',
  'transition-all duration-150',
  'hover:bg-white dark:hover:bg-muted',
  'hover:border-border',
  'hover:shadow-sm',
  'hover:text-foreground',
  'hover:[&_svg]:text-foreground',
  'data-[active=true]:bg-white dark:data-[active=true]:bg-muted',
  'data-[active=true]:border-border',
  'data-[active=true]:shadow-sm',
  'data-[active=true]:text-foreground',
  'data-[active=true]:font-medium',
  'data-[active=true]:[&_svg]:text-foreground',
];

const NAV: Array<{ label: string; items: Array<{ title: string; href: string; icon: LucideIcon }> }> = [
  {
    label: 'Operations',
    items: [
      { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { title: 'Users', href: '/users', icon: Users },
      { title: 'Devices', href: '/devices', icon: Smartphone },
      { title: 'Quotes', href: '/quotes', icon: Receipt },
      { title: 'Redemptions', href: '/redemptions', icon: Vault },
      { title: 'Transactions', href: '/transactions', icon: ArrowLeftRight },
      { title: 'Reviews', href: '/reviews', icon: ShieldCheck },
      { title: 'Fees', href: '/fees', icon: Percent },
    ],
  },
  {
    label: 'Registry',
    items: [
      { title: 'Assets', href: '/assets', icon: Boxes },
      { title: 'Issuers', href: '/issuers', icon: Landmark },
      { title: 'Chains', href: '/chains', icon: LinkIcon },
      { title: 'Providers', href: '/providers', icon: PlugZap },
    ],
  },
  {
    label: 'Oversight',
    items: [
      { title: 'Jobs', href: '/jobs', icon: Clock },
      { title: 'Notifications', href: '/notifications', icon: Bell },
      { title: 'Jurisdictions', href: '/jurisdictions', icon: Globe },
      { title: 'Audit log', href: '/audit', icon: ScrollText },
    ],
  },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {NAV.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map(({ title, href, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={title} className={itemClasses.join(' ')}>
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
      ))}
    </>
  );
}
