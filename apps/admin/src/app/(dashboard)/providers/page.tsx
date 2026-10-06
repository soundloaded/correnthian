import { apiFetch } from '@/lib/api-server';
import { ApiState } from '@/components/feedback/api-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { relativeTime } from '@/lib/format';
import { ProviderStatusSelect } from '@/components/actions/registry-actions';
import type { Provider } from '@/lib/types';

export const metadata = { title: 'Providers · Correnthian admin' };
export const dynamic = 'force-dynamic';

const STATUS_TONE = {
  active: 'default',
  degraded: 'secondary',
  disabled: 'outline',
} as const;

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
                <TableCell className="text-xs text-muted-foreground">
                  {p.capabilities.length ? p.capabilities.join(', ') : '—'}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">{p._count.quotes}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{p._count.redemptions}</TableCell>
                <TableCell className="text-muted-foreground">{relativeTime(p.lastCheckedAt)}</TableCell>
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
        <h1 className="text-2xl font-semibold tracking-tight">Providers</h1>
        <p className="text-sm text-muted-foreground">
          Status and health only. API credentials live in the secret store and are
          never in this table.
        </p>
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
