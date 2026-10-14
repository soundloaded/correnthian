import { ArrowRight, FileWarning, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { apiFetch } from '@/lib/api-server';
import { ApiState } from '@/components/feedback/api-state';
import { PageTitle } from '@/components/layout/page-title';
import { IssuerActions } from '@/components/actions/issuer-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { fmtCount, fmtDate } from '@/lib/format';
import type { Issuer } from '@/lib/types';

export const metadata = { title: 'Issuers · Correnthian admin' };
export const dynamic = 'force-dynamic';

const TIER_VARIANT = {
  issuer_verified: 'secondary',
  community_verified: 'outline',
  unverified: 'outline',
} as const;

/**
 * An issuer carries a claim about itself. This page exists so the claim is
 * always shown next to the evidence for it — the badge alone is the failure
 * mode the registry has already had once.
 */
export default async function IssuersPage() {
  const result = await apiFetch<Issuer[]>('/issuers');

  return (
    <>
      <header>
        <PageTitle title="Issuers">
          The entities behind tokens. A verification tier is a claim about the
          evidence shown beside it.
        </PageTitle>
      </header>

      <ApiState
        result={result}
        emptyTitle="No issuers registered"
        emptyDescription="Assets cannot be registered until their issuer exists."
        emptyWhen={(d) => d.length === 0}
        render={(issuers) => (
          <>
            <IssuerSummary issuers={issuers} />
            <ul className="flex flex-col gap-4">
              {issuers.map((issuer) => (
                <li key={issuer.id}>
                  <IssuerCard issuer={issuer} />
                </li>
              ))}
            </ul>
          </>
        )}
      />
    </>
  );
}

function IssuerSummary({ issuers }: { issuers: Issuer[] }) {
  const unsupported = issuers.filter(
    (i) => i.verifiedTier === 'issuer_verified' && !hasEvidence(i),
  );
  const byTier = (tier: Issuer['verifiedTier']): number =>
    issuers.filter((i) => i.verifiedTier === tier).length;

  return (
    <Card size="sm">
      <CardHeader>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          <Summary label="Issuers" value={fmtCount(issuers.length)} />
          <Summary label="Issuer verified" value={fmtCount(byTier('issuer_verified'))} />
          <Summary label="Community verified" value={fmtCount(byTier('community_verified'))} />
          <Summary
            label="Verified, no evidence"
            value={fmtCount(unsupported.length)}
            alert={unsupported.length > 0}
          />
        </div>
        {unsupported.length > 0 ? (
          <>
            <Separator className="my-2" />
            <p className="flex items-start gap-2 text-sm text-destructive">
              <FileWarning className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {unsupported.length === 1 ? 'One issuer is' : `${unsupported.length} issuers are`}{' '}
                marked <span className="font-mono">issuer_verified</span> with no
                licence evidence on file:{' '}
                <span className="font-mono">{unsupported.map((i) => i.slug).join(', ')}</span>.
                The tier is a claim about the evidence beside it; with no
                evidence, the claim is unsupported.
              </span>
            </p>
          </>
        ) : (
          <>
            <Separator className="my-2" />
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
              Every issuer carrying the{' '}
              <span className="font-mono">issuer_verified</span> tier has
              licence evidence on file.
            </p>
          </>
        )}
      </CardHeader>
    </Card>
  );
}

function IssuerCard({ issuer }: { issuer: Issuer }) {
  const evidence = hasEvidence(issuer);
  const unsupported = issuer.verifiedTier === 'issuer_verified' && !evidence;

  return (
    <Card size="sm" className="overflow-hidden">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="font-heading text-base">{issuer.name}</CardTitle>
          <Badge variant={TIER_VARIANT[issuer.verifiedTier]}>
            {issuer.verifiedTier.replace(/_/g, ' ')}
          </Badge>
          {unsupported ? <Badge variant="destructive">no licence evidence</Badge> : null}
        </div>
        <CardDescription className="font-mono">
          {issuer.slug} · {issuer.jurisdiction}
        </CardDescription>
        <CardAction>
          {issuer.website ? (
            <Button asChild size="sm" variant="ghost">
              <a href={issuer.website} target="_blank" rel="noreferrer noopener">
                Website
                <ArrowRight className="size-4" aria-hidden />
              </a>
            </Button>
          ) : null}
        </CardAction>
      </CardHeader>

      <CardContent className="grid gap-x-8 gap-y-3 md:grid-cols-2">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Fact label="Assets">{fmtCount(issuer._count.assets)}</Fact>
          <Fact label="Registered">{fmtDate(issuer.createdAt)}</Fact>
          <Fact label="Website">{issuer.website ?? '—'}</Fact>
          <Fact label="Risk flags">
            {issuer.riskFlags.length ? (
              <span className="font-medium text-destructive">
                {issuer.riskFlags.join(', ')}
              </span>
            ) : (
              'none'
            )}
          </Fact>
        </dl>

        {/*
          The evidence, not the badge. The left rule carries the signal:
          destructive when a verified tier has nothing behind it.
        */}
        <div
          className={`border-l-2 pl-4 ${unsupported ? 'border-destructive' : 'border-border'}`}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Evidence on file
          </p>
          <dl className="mt-2 space-y-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Licence types</dt>
              <dd>{issuer.licenseTypes.length ? issuer.licenseTypes.join(', ') : 'none recorded'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">References</dt>
              <dd className="break-words font-mono text-xs">
                {issuer.licenseRefs.length ? issuer.licenseRefs.join(', ') : 'none recorded'}
              </dd>
            </div>
            {issuer.notes ? (
              <div>
                <dt className="text-xs text-muted-foreground">Notes</dt>
                <dd className="text-muted-foreground">{issuer.notes}</dd>
              </div>
            ) : null}
          </dl>
          {unsupported ? (
            <p className="mt-2 flex items-start gap-1.5 text-sm font-medium text-destructive">
              <FileWarning className="mt-0.5 size-4 shrink-0" aria-hidden />
              Verified with no licence evidence on file. Lower the tier or attach
              the licences.
            </p>
          ) : null}
        </div>
      </CardContent>

      <CardFooter>
        <IssuerActions slug={issuer.slug} />
      </CardFooter>
    </Card>
  );
}

/**
 * Evidence means something the operator can point at: a licence type or a
 * reference. A tier is only as good as this.
 */
function hasEvidence(issuer: Issuer): boolean {
  return issuer.licenseTypes.length > 0 || issuer.licenseRefs.length > 0;
}

function Summary({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-mono text-2xl tabular-nums ${alert ? 'text-destructive' : ''}`}>
        {value}
      </p>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate">{children}</dd>
    </div>
  );
}
