import type { Contract } from '@correnthian/contracts';
import { apiFetch } from '@/lib/api-server';
import { ApiState } from '@/components/feedback/api-state';
import { PageTitle } from '@/components/layout/page-title';
import { JobRunButton } from '@/components/actions/job-actions';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtDateTime } from '@/lib/format';

type JobsStatus = Contract<'GET /api/v1/jobs'>;
type JobRow = JobsStatus['jobs'][number];

export const metadata = { title: 'Jobs · Correnthian admin' };
export const dynamic = 'force-dynamic';

const HEALTH_TONE: Record<JobRow['health'], 'default' | 'secondary' | 'outline' | 'destructive'> = {
  ok: 'default',
  running: 'secondary',
  failing: 'destructive',
  overdue: 'destructive',
  never_run: 'outline',
  disabled: 'outline',
};

/** Milliseconds as a human cadence. 86_400_000 is daily, not a magic number. */
function cadence(ms: number): string {
  if (ms % 3_600_000 === 0) {
    const h = ms / 3_600_000;
    return h === 24 ? 'daily' : `every ${h}h`;
  }
  const m = Math.round(ms / 60_000);
  return `every ${m}m`;
}

export default async function JobsPage() {
  const result = await apiFetch<JobsStatus>('/jobs');

  return (
    <>
      <header>
        <PageTitle title="Jobs">
          Scheduled work and whether the schedule is keeping up. Health is
          derived from the run ledger by the API &mdash; this page displays
          it, it does not recompute it.
        </PageTitle>
      </header>

      <ApiState
        result={result}
        render={(d) => (
          <>
            {!d.scheduler.running ? (
              <Card>
                <CardContent className="py-4 text-sm text-muted-foreground">
                  Scheduler idle on this instance
                  {d.scheduler.lastLeaseError ? ` — last lease error: ${d.scheduler.lastLeaseError}` : ''}.
                  Health below reads from the shared run ledger, so it holds on every replica.
                </CardContent>
              </Card>
            ) : null}
            <Card>
              <CardContent className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead>Cadence</TableHead>
                      <TableHead>Health</TableHead>
                      <TableHead>Last run</TableHead>
                      <TableHead className="text-right">Affected</TableHead>
                      <TableHead>Run</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.jobs.map((j) => (
                      <TableRow key={j.name}>
                        <TableCell>
                          <span className="font-mono text-xs font-medium">{j.name}</span>
                          <span className="block max-w-md text-xs text-muted-foreground">{j.description}</span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">{cadence(j.everyMs)}</TableCell>
                        <TableCell>
                          <Badge variant={HEALTH_TONE[j.health]}>
                            {j.health}{j.runningNow ? ' · running now' : ''}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs">
                          {j.lastRun ? (
                            <>
                              {fmtDateTime(j.lastRun.startedAt)}
                              {j.lastRun.error ? (
                                <span className="block max-w-md whitespace-normal text-destructive">
                                  {j.lastRun.error}
                                </span>
                              ) : (
                                <span className="block text-muted-foreground">
                                  {j.lastRun.trigger} · {j.lastRun.durationMs ?? '?'}ms
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">never</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {j.lastRun ? j.lastRun.affected : '—'}
                        </TableCell>
                        <TableCell>
                          <JobRunButton name={j.name} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      />
    </>
  );
}
