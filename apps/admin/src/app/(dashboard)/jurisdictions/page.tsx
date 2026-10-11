import type { Contract } from '@correnthian/contracts';
import { apiFetch } from '@/lib/api-server';
import { ApiState } from '@/components/feedback/api-state';
import { JurisdictionRuleForm } from '@/components/actions/jurisdiction-actions';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type RuleList = Contract<'GET /api/v1/compliance/rules'>;
type RuleRow = RuleList[number];

export const metadata = { title: 'Jurisdictions · Correnthian admin' };
export const dynamic = 'force-dynamic';

export default async function JurisdictionsPage() {
  const result = await apiFetch<RuleList>('/compliance/rules');

  return (
    <>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Jurisdictions</h1>
        <p className="text-sm text-muted-foreground">
          What each location may do. Changing a rule changes the product
          everywhere it applies &mdash; admin only, and never without a
          stated reason.
        </p>
      </header>

      <Card role="note" className="border-destructive">
        <CardContent className="py-4 text-sm">
          <span className="font-medium text-destructive">Development rules are not legal positions.</span>{' '}
          <span className="text-muted-foreground">
            The seeded rules are placeholders for counsel-reviewed rules. Do not
            treat an enabled flag here as permission to operate.
          </span>
        </CardContent>
      </Card>

      <ApiState
        result={result}
        emptyTitle="No jurisdiction rules"
        emptyDescription="Without a rule, every location is denied by default. Add rules through the API; this console only edits."
        emptyWhen={(d) => d.length === 0}
        render={(d) => (
          <Card>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Where</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Edit flags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.map((r: RuleRow) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">
                        <span className="font-mono text-xs font-medium">{r.country}</span>
                        {r.region ? (
                          <span className="text-xs text-muted-foreground"> / {r.region}</span>
                        ) : (
                          <span className="block text-xs text-muted-foreground">whole country</span>
                        )}
                        {r.notes ? (
                          <span className="block max-w-xs text-xs text-muted-foreground">{r.notes}</span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.active ? 'default' : 'outline'}>
                          {r.active ? 'active' : 'inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <JurisdictionRuleForm
                          id={r.id}
                          rule={{
                            canBuyCrypto: r.canBuyCrypto,
                            canSellCrypto: r.canSellCrypto,
                            canUseMetals: r.canUseMetals,
                            canRedeem: r.canRedeem,
                            kycRequired: r.kycRequired,
                            active: r.active,
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      />
    </>
  );
}
