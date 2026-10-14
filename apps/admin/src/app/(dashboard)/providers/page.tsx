import { apiFetch } from '@/lib/api-server';
import { ApiState } from '@/components/feedback/api-state';
import { PageTitle } from '@/components/layout/page-title';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtCount, relativeTime } from '@/lib/format';
import { ProviderStatusSelect } from '@/components/actions/registry-actions';
import type { Provider } from '@/lib/types';

export const metadata = { title: 'Providers · Correnthian admin' };
export const dynamic = 'force-dynamic';

/**
 * `degraded` gets the destructive tone, not `secondary`.
 *
 * A degraded provider is still offered on a rail, so it is the state an operator
 * must act on; grey would read as merely inactive. The word is in the badge
 * either way — the colour is a scan aid, never the disclosure.
 */
const STATUS_TONE = {
  active: 'default',
  degraded: 'destructive',
  disabled: 'outline',
} as const satisfies Record<Provider['status'], 'default' | 'destructive' | 'outline'>;

/**
 * Status and health only. API credentials live in the secret store, are never
 * serialised by the API, and so cannot be rendered here even by accident.
 */
export default async function ProvidersPage() {
  const result = await apiFetch<Provider[]>('/providers');

  const body = (providers: Provider[]) => (
    <Card>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Provider</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Capabilities</TableHead>
              <TableHead className="text-right">Quotes</TableHead>
              <TableHead className="text-right">Redemptions</TableHead>
              <TableHead>Last checked</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {providers.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="font-medium">{p.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">{p.slug}</div>
                </TableCell>
                <TableCell><Badge variant="outline">{p.category}</Badge></TableCell>
                <TableCell>
                  <Badge variant={STATUS_TONE[p.status]}>{p.status}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {p.capabilities.length ? p.capabilities.join(', ') : '—'}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {fmtCount(p._count.quotes)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {fmtCount(p._count.redemptions)}
                </TableCell>
                <TableCell
                  className={
                    p.lastCheckedAt
                      ? 'font-mono text-xs'
                      : 'font-mono text-xs text-destructive'
                  }
                >
                  {p.lastCheckedAt ? relativeTime(p.lastCheckedAt) : 'never checked'}
                </TableCell>
                <TableCell><ProviderStatusSelect slug={p.slug} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <>
      <header>
        <PageTitle title="Providers">
          Status and health only. API credentials live in the secret store and are
          never in this table — the admin shows whether a rail is usable, not how to
          call it.
        </PageTitle>
      </header>
      <ApiState
        result={result}
        emptyTitle="No providers registered"
        emptyDescription="Providers are added once a contract exists."
        emptyWhen={(d) => d.length === 0}
        render={body}
      />
    </>
  );
}