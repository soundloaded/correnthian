import Link from 'next/link';
import type { Contract } from '@correnthian/contracts';
import { apiFetch } from '@/lib/api-server';
import { ApiState } from '@/components/feedback/api-state';
import { PageTitle } from '@/components/layout/page-title';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtCount, fmtDateTime } from '@/lib/format';
import { RedemptionFilters } from './filters';

type RedemptionStats = Contract<'GET /api/v1/redemptions/stats'>;
type RedemptionList = Contract<'GET /api/v1/redemptions'>;
type RedemptionRow = RedemptionList['items'][number];

export const metadata = { title: 'Redemptions · Correnthian admin' };
export const dynamic = 'force-dynamic';

const STATE_TONE: Record<RedemptionRow['state'], 'default' | 'secondary' | 'outline' | 'destructive'> = {
  requested: 'secondary',
  kyc_pending: 'secondary',
  approved: 'default',
  in_production: 'default',
  shipped: 'default',
  delivered: 'default',
  rejected: 'destructive',
  cancelled: 'outline',
};

export default async function RedemptionsPage({ searchParams }: PageProps<'/redemptions'>) {
  const sp = await searchParams;
  const state = typeof sp.state === 'string' ? sp.state : '';
  const cursor = typeof sp.cursor === 'string' ? sp.cursor : '';

  const query = new URLSearchParams();
  if (state) query.set('state', state);
  if (cursor) query.set('cursor', cursor);

  const [stats, list] = await Promise.all([
    apiFetch<RedemptionStats>('/redemptions/stats'),
    apiFetch<RedemptionList>(`/redemptions?${query.toString()}`),
  ]);

  const nextPage = list.status === 'ok' && list.data.nextCursor
    ? `/redemptions?${new URLSearchParams({ ...Object.fromEntries(query), cursor: list.data.nextCursor }).toString()}`
    : null;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle title="Redemptions">
          Physical metal payouts. State advances only through explicit
          transitions &mdash; nothing here auto-approves.
        </PageTitle>
        <RedemptionFilters state={state} />
      </header>

      <ApiState
        result={stats}
        render={(d) => (
          <section aria-label="Redemption counters" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardContent className="flex items-baseline gap-2 py-6">
                <span className="font-mono text-3xl tabular-nums">{fmtCount(d.total)}</span>
                <span className="text-sm text-muted-foreground">requests recorded</span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-2 py-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">By state</p>
                {Object.entries(d.byState).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data</p>
                ) : (
                  Object.entries(d.byState).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between text-sm">
                      <span className="capitalize">{k.replace('_', ' ')}</span>
                      <span className="font-mono tabular-nums">{fmtCount(v)}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </section>
        )}
      />

      <ApiState
        result={list}
        emptyTitle={state ? 'No redemptions match those filters' : 'No redemptions yet'}
        emptyDescription={
          state ? 'Adjust the filter, or clear it.' : 'Requests appear here once users ask for physical payout.'
        }
        emptyWhen={(d) => d.items.length === 0}
        render={(d) => (
          <>
            <Card>
              <CardContent className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Asset</TableHead>
                      <TableHead>Amount (raw)</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>State</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.items.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap font-mono text-xs">
                          {fmtDateTime(r.requestedAt)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-medium">{r.asset.symbol}</TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs tabular-nums">
                          {r.amountRaw}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          <Badge variant="outline">{r.provider.slug}</Badge>
                          <span className="mt-0.5 block text-muted-foreground">{r.provider.name}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATE_TONE[r.state]}>{r.state.replace('_', ' ')}</Badge>
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
