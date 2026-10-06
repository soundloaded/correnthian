import { apiFetch } from '@/lib/api-server';
import { ApiState } from '@/components/state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtDateTime, shortAddress } from '@/lib/format';

export const metadata = { title: 'Audit · Correnthian admin' };
export const dynamic = 'force-dynamic';

interface AuditRow {
  id: string; actorId: string | null; actorRole: string | null;
  action: string; targetType: string | null; targetId: string | null;
  outcome: 'success' | 'failure' | 'denied'; ipAddress: string | null;
  createdAt: string;
}

export default async function AuditPage() {
  const result = await apiFetch<AuditRow[]>('/audit?limit=100');

  const body = (rows: AuditRow[]) => (
    <Card>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap font-mono text-xs">
                  {fmtDateTime(r.createdAt)}
                </TableCell>
                <TableCell className="font-medium">{r.action}</TableCell>
                <TableCell className="font-mono text-xs">
                  {shortAddress(r.actorId)}
                  {r.actorRole ? ` · ${r.actorRole}` : ''}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {r.targetType ? `${r.targetType}:${shortAddress(r.targetId)}` : '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={r.outcome === 'success' ? 'outline' : 'destructive'}>
                    {r.outcome}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
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
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          Append-only. Metadata is redacted before it is written.
        </p>
      </header>
      <ApiState
        result={result}
        emptyTitle="No audit entries yet"
        emptyWhen={(d) => d.length === 0}
        render={body}
      />
    </>
  );
}
