'use client';

import type { ReactNode } from 'react';
import { HeaderSearch } from './header-search';
import { HeaderUser } from './header-user';
import { SidebarTrigger } from '@/components/ui/sidebar';

/**
 * Shell header: trigger, search, queue bell, operator.
 *
 * `notices` is a server-rendered bell passed in from the layout, because a
 * client header cannot read the httpOnly session cookie the count needs.
 * Search is local-first (pages) plus live account lookup — see its own
 * component for the honesty rules.
 */
export function SiteHeader({
  user,
  notices,
}: {
  user: { email: string; role: string } | null;
  notices: ReactNode;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center border-b">
      <div className="flex w-full items-center gap-3 px-4">
        <SidebarTrigger className="size-8 shrink-0" />
        <div className="h-5 w-px shrink-0 bg-border" aria-hidden />
        <HeaderSearch />
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {notices}
          <HeaderUser session={user} />
        </div>
      </div>
    </header>
  );
}
