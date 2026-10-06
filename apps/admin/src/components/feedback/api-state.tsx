import Link from 'next/link';
import { AlertTriangle, Inbox, LockKeyhole, PlugZap } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SkeletonRows } from './retry-skeleton';
import { RetryButton } from './retry';
import type { ApiResult } from '@/lib/api-server';

/**
 * Every data-backed surface routes its outcome through here.
 *
 * The point is that "the API is down" is a designed state with a retry, not a
 * blank region. During an outage an admin needs to know *which* thing is
 * unavailable and be able to try again — not be bounced to a login screen,
 * which is what a naive handler that maps every failure to 401 produces.
 */
export function ApiState<T>({
  result,
  render,
  emptyWhen,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
}: {
  result: ApiResult<T>;
  /** Render prop: receives the fetched data and returns the surface. */
  render: (data: T) => ReactNode;
  emptyWhen?: (data: T) => boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  switch (result.status) {
    case 'ok':
      if (emptyWhen?.(result.data)) {
        return (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <Inbox className="size-5 text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium">{emptyTitle}</p>
              {emptyDescription ? (
                <p className="max-w-sm text-sm text-muted-foreground">{emptyDescription}</p>
              ) : null}
            </CardContent>
          </Card>
        );
      }
      return render(result.data);

    case 'unauthorised':
      return (
        <StateCard
          icon={<LockKeyhole className="size-5" aria-hidden />}
          title="Session expired"
          description="Your admin session has ended. Sign in again to continue."
          action={<Button asChild size="sm"><Link href="/login">Sign in</Link></Button>}
        />
      );

    case 'forbidden':
      return (
        <StateCard
          icon={<AlertTriangle className="size-5" aria-hidden />}
          title="Not permitted"
          description={result.message}
        />
      );

    case 'unavailable':
      return (
        <StateCard
          icon={<PlugZap className="size-5" aria-hidden />}
          title="API unavailable"
          description={result.message}
          action={<RetryButton />}
        />
      );

    case 'error':
      return (
        <StateCard
          icon={<AlertTriangle className="size-5" aria-hidden />}
          title="Request failed"
          description={result.message}
          action={<RetryButton />}
        />
      );

    default:
      return <SkeletonRows />;
  }
}

function StateCard({
  icon, title, description, action,
}: {
  icon: ReactNode; title: string; description: string; action?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="text-muted-foreground">{icon}</div>
        <p className="text-sm font-medium">{title}</p>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        {action}
      </CardContent>
    </Card>
  );
}
