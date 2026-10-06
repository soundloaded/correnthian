import Link from 'next/link';
import type { Contract } from '@correnthian/contracts';
import { apiFetch } from '@/lib/api-server';
import { ApiState } from '@/components/feedback/api-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtCount, fmtDateTime, fmtUsd } from '@/lib/format';
import { QuoteFilters } from './filters';

/**
 * Response types are inferred from the wire-format contracts, never written by
 * hand. `@correnthian/lib/types` cannot be extended from here, so these live
 * beside the page that uses them — still inferred, which is the part that
 * matters: when the API changes shape, `Contract<>` changes with it and this
 * file stops compiling.
 */
type QuoteStats = Contract<'GET /swaps/quotes/stats'>;
type QuoteList = Contract<'GET /swaps/quotes'>;
type QuoteRow = QuoteList['items'][number];
type QuoteState = QuoteRow['state'];

export const metadata = { title: 'Quotes · Correnthian admin' };
export const dynamic = 'force-dynamic';

const STATE_TONE: Record<QuoteState, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  // Settled is the only state that means the user got metal.
  settled: 'default',
  quoted: 'secondary',
  awaiting_payment: 'secondary',
  broadcast: 'secondary',
  expired: 'outline',
  // A failed quote is a user who was shown a price and did not get it.
  failed: 'destructive',
};

/** Basis points as a percentage. 50 bps is half a percent, not 50%. */
const pct = (bps: number) => `${(bps / 100).toFixed(2)}%`;

export default async function QuotesPage({ searchParams }: PageProps<'/quotes'>) {
  const sp = await searchParams;
  const state = typeof sp.state === 'string' ? sp.state : '';
  const railKind = typeof sp.railKind === 'string' ? sp.railKind : '';
  const cursor = typeof sp.cursor === 'string' ? sp.cursor : '';

  const query = new URLSearchParams();
  if (state) query.set('state', state);
  if (railKind) query.set('railKind', railKind);
  if (cursor) query.set('cursor', cursor);

  const [stats, list] = await Promise.all([
    apiFetch<QuoteStats>('/swaps/quotes/stats'),
    apiFetch<QuoteList>(`/swaps/quotes?${query.toString()}`),
  ]);

  const nextPage = list.status === 'ok' && list.data.nextCursor
    ? `/quotes?${new URLSearchParams({ ...Object.fromEntries(query), cursor: list.data.nextCursor }).toString()}`
    : null;

  const body = (d: QuoteList) => (
    <>
      <Card>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>From &rarr; To</TableHead>
                <TableHead>Amount (raw)</TableHead>
                <TableHead>Rail</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="text-right">Impact</TableHead>
                <TableHead className="text-right">Slippage</TableHead>
                <TableHead className="text-right">Size cap</TableHead>
                <TableHead>Quality</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.items.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="whitespace-nowrap font-mono text-xs">
                    {fmtDateTime(q.createdAt)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-medium">
                    {q.fromAsset.symbol}
                    <span className="px-1 text-muted-foreground">&rarr;</span>
                    {q.toAsset.symbol}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs">
                    {q.fromAmountRaw}
                    {q.notionalUsd !== null ? (
                      <span className="block text-muted-foreground">
                        {fmtUsd(q.notionalUsd)}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    <Badge variant="outline">{q.railKind}</Badge>
                    <span className="mt-0.5 block text-muted-foreground">
                      {/* "No provider" is an answer, not a missing join. */}
                      {q.provider ? q.provider.name : 'unassigned'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATE_TONE[q.state]}>{q.state.replace('_', ' ')}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {pct(q.priceImpactBps)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {pct(q.slippageBps)}
                  </TableCell>
                  {/* The two columns that decide whether a quote can be
                      filled at the price it quoted. */}
                  <TableCell className="text-right font-mono tabular-nums">
                    {q.sizeCapUsd === null ? (
                      <span className="text-muted-foreground">uncapped</span>
                    ) : (
                      fmtUsd(q.sizeCapUsd)
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={q.executable ? 'outline' : 'secondary'}>
                      {q.executionQuality}
                    </Badge>
                    {!q.executable ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        not executable
                      </span>
                    ) : null}
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
  );

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quotes</h1>
          <p className="text-sm text-muted-foreground">
            Quotes are recorded and disclosed. Nothing executes server-side &mdash; the user
            signs in their own wallet.
          </p>
        </div>
        <QuoteFilters state={state} railKind={railKind} />
      </header>

      <ApiState
        result={stats}
        render={(d) => (
          <section aria-label="Quote counters" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardContent className="flex items-baseline gap-2 py-6">
                <span className="font-mono text-3xl tabular-nums">{fmtCount(d.total)}</span>
                <span className="text-sm text-muted-foreground">quotes recorded</span>
              </CardContent>
            </Card>
            <Breakdown title="By state" data={d.byState} />
            <Breakdown title="By rail" data={d.byRail} />
          </section>
        )}
      />

      {stats.status === 'ok' && Object.values(stats.data.byState).every((v) => v === 0) ? (
        <p className="text-sm text-muted-foreground">
          No quotes yet. Execution stays unavailable until a metals provider is
          contracted &mdash; the API will not fabricate an executable price.
        </p>
      ) : null}

      <ApiState
        result={list}
        emptyTitle={state || railKind ? 'No quotes match those filters' : 'No quotes yet'}
        emptyDescription={
          state || railKind
            ? 'Adjust the filters, or clear them.'
            : 'Execution stays unavailable until a metals provider is contracted.'
        }
        emptyWhen={(d) => d.items.length === 0}
        render={body}
      />
    </>
  );
}

function Breakdown({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data);
  return (
    <Card>
      <CardContent className="space-y-2 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data</p>
        ) : (
          entries.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between text-sm">
              <span className="capitalize">{k.replace('_', ' ')}</span>
              <span className="font-mono tabular-nums">{fmtCount(v)}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}