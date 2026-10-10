import type { Contract } from '@correnthian/contracts';
import { apiFetch } from '@/lib/api-server';
import { ApiState } from '@/components/feedback/api-state';
import { FeeRuleCreateForm, FeeRuleToggle } from '@/components/actions/fee-rule-actions';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type FeeRules = Contract<'GET /api/v1/fees/rules'>;
type FeeDiagnostics = Contract<'GET /api/v1/fees/rules/diagnostics'>;
type FeeRule = FeeRules[number];

export const metadata = { title: 'Fees · Correnthian admin' };
export const dynamic = 'force-dynamic';

function rateOf(r: FeeRule): string {
  if (r.basis === 'percent' && r.rateBps !== null) return `${(r.rateBps / 100).toFixed(2)}%`;
  if (r.basis === 'fixed' && r.fixedUsd !== null) return `$${r.fixedUsd}`;
  if (r.basis === 'spread') return 'spread';
  return '—';
}

export default async function FeesPage() {
  const [rules, diagnostics] = await Promise.all([
    apiFetch<FeeRules>('/fees/rules'),
    apiFetch<FeeDiagnostics>('/fees/rules/diagnostics'),
  ]);

  return (
    <>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Fees</h1>
        <p className="text-sm text-muted-foreground">
          The rule table every quote prices from. Reading takes admin;
          creating or changing a rule takes owner <em>and</em> a stated
          reason &mdash; a number that moves without a why is a number no
          investigator can explain.
        </p>
      </header>

      <ApiState
        result={diagnostics}
        render={(d) =>
          d.clear ? null : (
            <Card role="alert" className="border-destructive">
              <CardHeader>
                <CardTitle className="text-sm text-destructive">
                  {d.conflicts.length} ambiguous rule{d.conflicts.length === 1 ? '' : 's'} — quotes on these pairs refuse until resolved
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {d.conflicts.map((c) => (
                  <div key={`${c.operation}-${c.kind}-${c.ruleIds.join('+')}`} className="text-sm">
                    <p>
                      <span className="font-medium">{c.operation} / {c.kind}</span>
                      <span className="text-muted-foreground"> — {c.detail}</span>
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                      {c.ruleIds.join(', ')}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )
        }
      />

      <ApiState
        result={rules}
        emptyTitle="No fee rules"
        emptyDescription="Without rules every preview shows an explicit $0 Correnthian line — never a spread hidden in the rate."
        emptyWhen={(d) => d.length === 0}
        render={(d) => (
          <Card>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operation</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Basis</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap font-medium">{r.operation}</TableCell>
                      <TableCell>{r.kind}</TableCell>
                      <TableCell>{r.basis}</TableCell>
                      <TableCell>{r.label}</TableCell>
                      <TableCell className="whitespace-nowrap text-right font-mono tabular-nums">
                        {rateOf(r)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{r.priority}</TableCell>
                      <TableCell>
                        <Badge variant={r.active ? 'default' : 'outline'}>
                          {r.active ? 'active' : 'inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <FeeRuleToggle id={r.id} active={r.active} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">New rule (owner only)</CardTitle>
        </CardHeader>
        <CardContent>
          <FeeRuleCreateForm />
        </CardContent>
      </Card>
    </>
  );
}
