import { apiFetch } from '@/lib/api-server';
import { ApiState } from '@/components/state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { fmtDate } from '@/lib/format';
import { IssuerActions } from '@/components/admin/issuer-actions';
import type { Issuer } from '@/lib/types';

export const metadata = { title: 'Issuers · Correnthian admin' };
export const dynamic = 'force-dynamic';

const TIER_TONE = {
  issuer_verified: 'default',
  community_verified: 'secondary',
  unverified: 'outline',
} as const;

export default async function IssuersPage() {
  const result = await apiFetch<Issuer[]>('/issuers');

  const body = (issuers: Issuer[]) => (
    <div className="space-y-3">
      {issuers.map((i) => {
        // The tier badge is the load-bearing part of this page. An issuer with
        // no licences on file must never read as verified, whatever the stored
        // tier says — so surface the evidence next to the claim.
        const evidence = i.licenseTypes.length + i.licenseRefs.length;
        return (
          <Card key={i.id}>
            <CardContent className="grid gap-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{i.name}</span>
                  <Badge variant={TIER_TONE[i.verifiedTier]}>{i.verifiedTier.replace(/_/g, ' ')}</Badge>
                </div>
                <p className="font-mono text-xs text-muted-foreground">
                  {i.slug} · {i.jurisdiction}
                </p>
                <p className="text-xs text-muted-foreground">
                  {i._count.assets} asset{i._count.assets === 1 ? '' : 's'} · added{' '}
                  {fmtDate(i.createdAt)}
                </p>
                {i.riskFlags.length ? (
                  <p className="font-mono text-xs text-destructive">
                    flags: {i.riskFlags.join(', ')}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="rounded-md bg-muted/40 p-3 text-xs">
                <p className="font-medium uppercase tracking-wide text-muted-foreground">
                  Evidence on file
                </p>
                <p>
                  <span className="text-muted-foreground">Licences:</span>{' '}
                  {i.licenseTypes.length ? i.licenseTypes.join(', ') : 'none recorded'}
                </p>
                <p>
                  <span className="text-muted-foreground">References:</span>{' '}
                  {i.licenseRefs.length ? i.licenseRefs.join(', ') : 'none recorded'}
                </p>
                {i.verifiedTier === 'issuer_verified' && evidence === 0 ? (
                  <p className="text-destructive">
                    Verified with no licence evidence on file — investigate.
                  </p>
                ) : null}
                {i.notes ? (
                  <p className="text-muted-foreground">{i.notes}</p>
                ) : null}
                </div>
                <IssuerActions slug={i.slug} />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  return (
    <>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Issuers</h1>
        <p className="text-sm text-muted-foreground">
          The entities behind tokens. A verification tier is a claim about the
          evidence shown here.
        </p>
      </header>
      <ApiState
        result={result}
        emptyTitle="No issuers registered"
        emptyDescription="Assets cannot be registered until their issuer exists."
        emptyWhen={(d) => d.length === 0}
        render={body}
      />
    </>
  );
}
