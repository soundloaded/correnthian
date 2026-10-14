import type { Contract } from '@correnthian/contracts';
import { apiFetch } from '@/lib/api-server';
import { ApiState } from '@/components/feedback/api-state';
import { PageTitle } from '@/components/layout/page-title';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtDateTime, shortAddress } from '@/lib/format';
import { AuditFilters } from './filters';

/**
 * Inferred from the wire-format contract, not hand-written — see the note on
 * the quotes page. `actorEmail` is resolved by the API because an operator
 * cannot act on a cuid.
 */
type AuditRow = Contract<'GET /api/v1/audit'>[number];
type AuditOutcome = AuditRow['outcome'];

export const metadata = { title: 'Audit · Correnthian admin' };
export const dynamic = 'force-dynamic';

/**
 * `denied` is the one that matters. A denied action is a refusal someone may
 * need to explain, so it is the only outcome that earns the destructive tone.
 */
const OUTCOME_TONE: Record<AuditOutcome, 'outline' | 'secondary' | 'destructive'> = {
  success: 'outline',
  failure: 'secondary',
  denied: 'destructive',
};

export default async function AuditPage({ searchParams }: PageProps<'/audit'>) {
  const sp = await searchParams;
  const action = typeof sp.action === 'string' ? sp.action : '';
  const outcome = typeof sp.outcome === 'string' ? sp.outcome : '';

  const query = new URLSearchParams({ limit: '100' });
  if (action) query.set('action', action);
  if (outcome) query.set('outcome', outcome);

  const result = await apiFetch<AuditRow[]>(`/audit?${query.toString()}`);
  const filtered = Boolean(action || outcome);

  const body = (rows: AuditRow[]) => (
    <Card>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap font-mono text-xs">
                  {fmtDateTime(r.createdAt)}
                </TableCell>
                <TableCell>
                  <Badge variant={OUTCOME_TONE[r.outcome]}>{r.outcome}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs font-medium">{r.action}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {r.actorEmail ?? shortAddress(r.actorId)}
                  {r.actorRole ? (
                    <span className="block text-xs text-muted-foreground">{r.actorRole}</span>
                  ) : null}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {r.targetType ? `${r.targetType}:${shortAddress(r.targetId)}` : '—'}
                </TableCell>
                <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                  {r.ipAddress ?? '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle title="Audit log">
          Append-only. Metadata is redacted before it is written.
        </PageTitle>
        <AuditFilters action={action} outcome={outcome} />
      </header>

      <ApiState
        result={result}
        emptyTitle={filtered ? 'No audit entries match' : 'No audit entries yet'}
        emptyDescription={filtered ? 'Adjust the filters, or clear them.' : undefined}
        emptyWhen={(d) => d.length === 0}
        render={body}
      />
    </>
  );
}