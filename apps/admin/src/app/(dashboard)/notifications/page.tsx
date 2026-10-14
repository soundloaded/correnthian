import Link from 'next/link';
import type { Contract } from '@correnthian/contracts';
import { apiFetch } from '@/lib/api-server';
import { ApiState } from '@/components/feedback/api-state';
import { PageTitle } from '@/components/layout/page-title';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtCount, fmtDateTime } from '@/lib/format';
import { NotificationFilters } from './filters';

type NotificationStats = Contract<'GET /api/v1/notifications/stats'>;
type NotificationList = Contract<'GET /api/v1/notifications'>;
type NotificationRow = NotificationList['items'][number];

export const metadata = { title: 'Notifications · Correnthian admin' };
export const dynamic = 'force-dynamic';

const STATE_TONE: Record<NotificationRow['state'], 'default' | 'secondary' | 'destructive'> = {
  pending: 'secondary',
  sent: 'default',
  failed: 'destructive',
};

export default async function NotificationsPage({ searchParams }: PageProps<'/notifications'>) {
  const sp = await searchParams;
  const state = typeof sp.state === 'string' ? sp.state : '';
  const cursor = typeof sp.cursor === 'string' ? sp.cursor : '';

  const query = new URLSearchParams();
  if (state) query.set('state', state);
  if (cursor) query.set('cursor', cursor);

  // No resend action lives on this page, deliberately: no delivery
  // transport is wired, and a button that claimed to send would be a lie
  // in UI form. Rows are queued records, and the page says so.
  const [stats, list] = await Promise.all([
    apiFetch<NotificationStats>('/notifications/stats'),
    apiFetch<NotificationList>(`/notifications?${query.toString()}`),
  ]);

  const nextPage = list.status === 'ok' && list.data.nextCursor
    ? `/notifications?${new URLSearchParams({ ...Object.fromEntries(query), cursor: list.data.nextCursor }).toString()}`
    : null;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle title="Notifications">
          Queued records, not sent mail &mdash; delivery is recorded first
          and flushed by a transport worker once a provider exists.
        </PageTitle>
        <NotificationFilters state={state} />
      </header>

      <ApiState
        result={stats}
        render={(d) => (
          <section aria-label="Delivery counters" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ['queued', d.total],
                ['pending', d.pending],
                ['sent', d.sent],
                ['failed', d.failed],
              ] as const
            ).map(([label, v]) => (
              <Card key={label}>
                <CardContent className="flex items-baseline gap-2 py-6">
                  <span className="font-mono text-3xl tabular-nums">{fmtCount(v)}</span>
                  <span className="text-sm text-muted-foreground">{label}</span>
                </CardContent>
              </Card>
            ))}
          </section>
        )}
      />

      <ApiState
        result={list}
        emptyTitle={state ? 'No notifications match those filters' : 'No notifications queued'}
        emptyDescription={state ? 'Adjust the filter, or clear it.' : 'Rows appear here when the API enqueues them.'}
        emptyWhen={(d) => d.items.length === 0}
        render={(d) => (
          <>
            <Card>
              <CardContent className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.items.map((n) => (
                      <TableRow key={n.id}>
                        <TableCell className="whitespace-nowrap font-mono text-xs">
                          {fmtDateTime(n.createdAt)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Link href={`/users/${n.user.id}`} className="font-medium underline">
                            {n.user.email}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{n.channel}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs">{n.template}</TableCell>
                        <TableCell>
                          <Badge variant={STATE_TONE[n.state]}>{n.state}</Badge>
                        </TableCell>
                        <TableCell className="max-w-xs text-xs text-destructive">
                          {n.error ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {nextPage ? (
              <Link href={nextPage} className="text-sm underline">
                Next page
              </Link>
            ) : null}
          </>
        )}
      />
    </>
  );
}
