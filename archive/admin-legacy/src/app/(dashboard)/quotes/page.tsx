import { apiFetch } from '@/lib/api-server';
import { ApiState } from '@/components/state';
import { Card, CardContent } from '@/components/ui/card';
import { fmtCount } from '@/lib/format';

export const metadata = { title: 'Quotes · Correnthian admin' };
export const dynamic = 'force-dynamic';

interface QuoteStats {
  total: number;
  byState: Record<string, number>;
  byRail: Record<string, number>;
}

export default async function QuotesPage() {
  const result = await apiFetch<QuoteStats>('/swaps/quotes/stats');

  return (
    <>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Quotes</h1>
        <p className="text-sm text-muted-foreground">
          Quotes are recorded and disclosed. Nothing executes server-side — the user
          signs in their own wallet.
        </p>
      </header>

      <ApiState result={result} render={(d) => (
        <>
          <Card>
            <CardContent className="flex items-baseline gap-2 py-6">
              <span className="font-mono text-3xl tabular-nums">{fmtCount(d.total)}</span>
              <span className="text-sm text-muted-foreground">quotes recorded</span>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Breakdown title="By state" data={d.byState} />
            <Breakdown title="By rail" data={d.byRail} />
          </div>

          {Object.values(d.byState).every((v) => v === 0) ? (
            <p className="text-sm text-muted-foreground">
              No quotes yet. Execution stays unavailable until a metals provider is
              contracted — the API will not fabricate an executable price.
            </p>
          ) : null}
        </>
      )} />
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
