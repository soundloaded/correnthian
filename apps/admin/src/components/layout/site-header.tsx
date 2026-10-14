'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';

/**
 * Shell header: trigger, tagline, and a bell that links to the queue.
 *
 * The bell is a plain link, deliberately — there is no unread-count API,
 * and a badge with a number nobody computed would be decoration presented
 * as information. It gains a count when the backend can supply one.
 */
export function SiteHeader() {
  return (
    <header className="flex h-14 shrink-0 items-center border-b">
      <div className="flex w-full items-center gap-3 px-4">
        <SidebarTrigger className="size-8 shrink-0" />
        <div className="h-5 w-px bg-border" aria-hidden />
        <p className="truncate text-sm text-muted-foreground">
          Internal operations · changes are audited
        </p>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/notifications"
            aria-label="Notification queue"
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Bell className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </header>
  );
}
