import Link from 'next/link';
import { Bell } from 'lucide-react';
import type { Contract } from '@correnthian/contracts';
import { apiFetch } from '@/lib/api-server';

type NotificationStats = Contract<'GET /api/v1/notifications/stats'>;

/**
 * Queue bell with a pending-count badge.
 *
 * Server-rendered beside the shell, so the count is read with the operator's
 * session on every page load. A failed read renders a plain bell rather than
 * a badge nobody computed — absence of signal, not a zero.
 */
export async function HeaderNotifications() {
  const result = await apiFetch<NotificationStats>('/notifications/stats');
  const pending = result.status === 'ok' ? result.data.pending : 0;

  return (
    <Link
      href="/notifications"
      aria-label={pending > 0 ? `${pending} queued notifications` : 'Notification queue'}
      className="relative flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Bell className="size-4" aria-hidden />
      {pending > 0 ? (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
          {pending > 9 ? '9+' : pending}
        </span>
      ) : null}
    </Link>
  );
}
