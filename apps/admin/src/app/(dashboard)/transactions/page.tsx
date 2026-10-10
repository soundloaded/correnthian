import Link from 'next/link';
import type { Contract } from '@correnthian/contracts';
import { apiFetch } from '@/lib/api-server';
import { ApiState } from '@/components/feedback/api-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtCount, fmtDateTime } from '@/lib/format';
import { TransactionFilters } from './filters';

type TxStats = Contract<'GET /api/v1/transactions/stats'>;
type TxList = Contract<'GET /api/v1/transactions'>;
type TxRow = TxList['items'][number];

export const metadata = { title: 'Transactions · Correnthian admin' };
export const dynamic = 'force-dynamic';

const STATE_TONE: Record<TxRow['state'], 'default' | 'secondary' | 'outline' | 'destructive'> = {
  created: 'secondary',
  signed: 'secondary',
  broadcast: 'secondary',
  pending: 'secondary',
  confirmed: 'default',
  failed: 'destructive',
  cancelled: 'outline',
  expired: 'outline',
};

export default async function TransactionsPage({ searchParams }: PageProps<'/transactions'>) {
  const sp = await searchParams;
  const state = typeof sp.state === 'string' ? sp.state : '';
  const direction = typeof sp.direction === 'string' ? sp.direction : '';
  const walletId = typeof sp.walletId === 'string' ? sp.walletId : '';
  const cursor = typeof sp.cursor === 'string' ? sp.cursor : '';

  const query = new URLSearchParams();
  if (state) query.set('state', state);
  if (direction) query.set('direction', direction);
  if (walletId) query.set('walletId', walletId);
  if (cursor) query.set('cursor', cursor);

  const [stats, list] = await Promise.all([
    apiFetch<TxStats>('/transactions/stats'),
    apiFetch<TxList>(`/transactions?${query.toString()}`),
  ]);

  const nextPage = list.status === 'ok' && list.data.nextCursor
    ? `/transactions?${new URLSearchParams({ ...Object.fromEntries(query), cursor: list.data.nextCursor }).toString()}`
    : null;

  const filtered = state !== '' || direction !== '' || walletId !== '';

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            Every observed and assembled transaction. Confirmations are counted
            against the depth each row requires &mdash; a row below its depth
            is not final.
          </p>
        </div>
        <TransactionFilters state={state} direction={direction} walletId={walletId} />
      </header>

      <ApiState
        result={stats}
        render={(d) => (
          <section aria-label="Transaction counters" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardContent className="flex items-baseline gap-2 py-6">
                <span className="font-mono text-3xl tabular-nums">{fmtCount(d.total)}</span>
                <span className="text-sm text-muted-foreground">transactions tracked</span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-2 py-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">By state</p>
                {Object.entries(d.byState).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{k}</span>
                    <span className="font-mono tabular-nums">{fmtCount(v)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-2 py-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">By direction</p>
                {Object.entries(d.byDirection).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{k}</span>
                    <span className="font-mono tabular-nums">{fmtCount(v)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        )}
      />

      <ApiState
        result={list}
        emptyTitle={filtered ? 'No transactions match those filters' : 'No transactions yet'}
        emptyDescription={
          filtered ? 'Adjust the filters, or clear them.' : 'Assembled, broadcast and observed rows appear here.'
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
                      <TableHead>Direction</TableHead>
                      <TableHead>Asset</TableHead>
                      <TableHead className="text-right">Amount (raw)</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead className="text-right">Confirmations</TableHead>
                      <TableHead className="text-right">Drops</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.items.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="whitespace-nowrap font-mono text-xs">
                          {fmtDateTime(t.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{t.direction}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-medium">{t.asset.symbol}</TableCell>
                        <TableCell className="whitespace-nowrap text-right font-mono text-xs tabular-nums">
                          {t.amountRaw}
                        </TableCell>
                        <TableCell>
                          <Link href={`/transactions/${t.id}`} className="underline">
                            <Badge variant={STATE_TONE[t.state]}>{t.state}</Badge>
                          </Link>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right font-mono text-xs tabular-nums">
                          {t.confirmations}
                          <span className="text-muted-foreground"> / {t.requiredConfirmations}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums">
                          {t.dropCount > 0 ? t.dropCount : <span className="text-muted-foreground">0</span>}
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
