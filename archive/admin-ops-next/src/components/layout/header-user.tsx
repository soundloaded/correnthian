'use client';

import { LogOut } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { logoutAction } from '@/app/(dashboard)/actions';

/**
 * The signed-in operator in the header. Same session the sidebar footer
 * shows; the header copy is the compact one, because the shell already
 * names the operator once.
 */
export function HeaderUser({ session }: { session: { email: string; role: string } | null }) {
  const initials = (session?.email ?? '—').slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={session ? `Signed in as ${session.email}` : 'Not signed in'}
          className="flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-muted"
        >
          <Avatar className="size-7 rounded-lg">
            <AvatarFallback className="rounded-lg text-xs">{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">Signed in as</p>
          <p className="truncate text-xs text-muted-foreground">{session?.email}</p>
          <Badge variant="outline" className="mt-1.5">{session?.role}</Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => void logoutAction()}>
          <LogOut aria-hidden /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
