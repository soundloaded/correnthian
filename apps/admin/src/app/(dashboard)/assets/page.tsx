import Link from 'next/link';
import { ShieldAlert, Vault } from 'lucide-react';
import type { ReactNode } from 'react';
import { apiFetch } from '@/lib/api-server';
import { ApiState } from '@/components/feedback/api-state';
import { PageTitle } from '@/components/layout/page-title';
import { AssetActions } from '@/components/actions/asset-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { fmtCount, fmtDate, shortAddress } from '@/lib/format';
import type { AssetStats, AssetSummary } from '@/lib/types';

export const metadata = { title: 'Assets · Correnthian admin' };
export const dynamic = 'force-dynamic';

/** Matches the API's `category` enum exactly, so a chip can never 400. */
const CATEGORIES = ['metal', 'stablecoin', 'crypto', 'treasury', 'fund', 'other'] as const;

/** The API's maximum page size. At this many rows the list is truncated. */
const PAGE_LIMIT = 200;

const TIER_VARIANT = {
  'issuer-verified': 'secondary',
  'community-verified': 'outline',
  unverified: 'outline',
} as const;

const CUSTODY_VARIANT = {
  allocated: 'secondary',
  unallocated: 'outline',
  synthetic: 'destructive',
} as const;

/**
 * The registry.
 *
 * The disclosure string is the point of this page, so it gets a full-bleed
 * band per row rather than a table cell: it is long prose, and truncating it
 * would defeat the reason the admin exists. It is rendered exactly as the API
 * sends it — `row.disclosure` — and never rebuilt from `asset.backing` on the
 * client, because a second implementation drifts, and it drifts toward
 * whatever is easiest to get wrong.
 */
export default async function AssetsPage({ searchParams }: PageProps<'/assets'>) {
  const sp = await searchParams;
  const raw = sp.category;
  const category = typeof raw === 'string' ? raw : '';

  const [result, stats] = await Promise.all([
    apiFetch<AssetSummary[]>(
      `/assets?limit=${PAGE_LIMIT}${category ? `&category=${encodeURIComponent(category)}` : ''}`,
    ),
    apiFetch<AssetStats>('/assets/stats'),
  ]);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle title="Asset registry">
          Every entry carries the disclosure shown to users, verbatim.
        </PageTitle>
        <ApiState result={stats} render={(d) => (
          <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
            <Stat label="registered" value={fmtCount(d.total)} />
            <Stat label="enabled" value={fmtCount(d.enabled)} />
            <Stat label="enabled metals" value={fmtCount(d.enabledMetals)} />
            <Stat
              label="stale attestations"
              value={fmtCount(d.staleAttestations)}
              alert={d.staleAttestations > 0}
            />
          </dl>
        )} />
      </header>

      <nav aria-label="Filter by category">
        <ul className="flex flex-wrap gap-2">
          <li>
            <Button asChild size="sm" variant={category === '' ? 'secondary' : 'outline'}>
              <Link href="/assets">All</Link>
            </Button>
          </li>
          {CATEGORIES.map((c) => (
            <li key={c}>
              <Button asChild size="sm" variant={category === c ? 'secondary' : 'outline'}>
                <Link href={`/assets?category=${c}`}>{c}</Link>
              </Button>
            </li>
          ))}
        </ul>
      </nav>

      <ApiState
        result={result}
        emptyTitle={category ? `No ${category} assets registered` : 'Registry is empty'}
        emptyDescription={
          category
            ? 'Clear the filter to see every registered asset.'
            : 'Assets appear here once registered through the API.'
        }
        emptyWhen={(d) => d.length === 0}
        render={(rows) => (
          <>
            <ul className="flex flex-col gap-4">
              {rows.map((row) => (
                <li key={row.asset.assetId}>
                  <AssetCard row={row} />
                </li>
              ))}
            </ul>
            {rows.length >= PAGE_LIMIT ? (
              <p className="text-sm text-muted-foreground">
                Showing the first {PAGE_LIMIT} assets. The registry is larger than
                one API response; narrow the filter to see the rest.
              </p>
            ) : null}
          </>
        )}
      />
    </>
  );
}

function AssetCard({ row }: { row: AssetSummary }) {
  const a = row.asset;
  const { backing, trust } = a;

  return (
    <Card size="sm" className="overflow-hidden">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{a.symbol}</CardTitle>
          <span className="text-sm text-muted-foreground">{a.name}</span>
          <Badge variant={a.enabled ? 'secondary' : 'outline'}>
            {a.enabled ? 'enabled' : 'disabled'}
          </Badge>
          <Badge variant={TIER_VARIANT[trust.verifiedTier]}>{trust.verifiedTier}</Badge>
          <Badge variant={CUSTODY_VARIANT[backing.custodyModel]}>{backing.custodyModel}</Badge>
          {backing.custodyModel === 'synthetic' ? (
            <Badge variant="destructive">synthetic — not metal</Badge>
          ) : null}
          {!backing.lastAttestation ? (
            <Badge variant="destructive">never attested</Badge>
          ) : null}
        </div>
        <CardDescription className="font-mono">
          {a.assetId} · chain {String(a.chainId)}
          {a.contractAddress ? ` · ${shortAddress(a.contractAddress)}` : ' · native'}
        </CardDescription>
      </CardHeader>

      <div className="grid gap-x-6 gap-y-2 border-y bg-muted/40 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
        <Fact label="Custodian">{backing.custodian ?? '—'}</Fact>
        <Fact label="Vault locations">
          {backing.vaultLocation.length ? backing.vaultLocation.join(', ') : '—'}
        </Fact>
        <Fact label="Last attestation">
          {backing.lastAttestation ? (
            <span className="font-mono">{fmtDate(backing.lastAttestation)}</span>
          ) : (
            <span className="font-medium text-destructive">never attested</span>
          )}
        </Fact>
        <Fact label="Attestation cadence">{backing.attestationCadence}</Fact>
        <Fact label="Issuer">
          {a.issuer.issuerName} · {a.issuer.jurisdiction}
        </Fact>
        <Fact label="Category">{a.display.category}</Fact>
        <Fact label="Metal per token">
          {backing.gramsPerToken !== null
            ? `${backing.gramsPerToken} g`
            : backing.ouncesPerToken !== null
              ? `${backing.ouncesPerToken} troy oz`
              : '—'}
        </Fact>
        <Fact label="Proof of reserve">
          {backing.proofOfReserve ? (
            <a
              href={backing.proofOfReserve}
              target="_blank"
              rel="noreferrer noopener"
              className="underline underline-offset-4"
            >
              View
            </a>
          ) : (
            '—'
          )}
        </Fact>
      </div>

      {/* Verbatim. Not summarised, not truncated, not rebuilt client-side. */}
      <div className="px-4 py-4">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Vault className="size-4" aria-hidden />
          Disclosure shown to users
        </p>
        <p className="mt-1.5 text-base leading-relaxed selectable">{row.disclosure}</p>
        {trust.riskFlags.length ? (
          <>
            <Separator className="my-3" />
            <p className="flex items-start gap-1.5 text-sm font-medium text-destructive">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              Risk flags: {trust.riskFlags.join(', ')}
            </p>
          </>
        ) : null}
      </div>

      <CardFooter>
        <AssetActions assetId={a.assetId} enabled={a.enabled} />
      </CardFooter>
    </Card>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm">{children}</dd>
    </div>
  );
}

function Stat({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`font-mono tabular-nums ${alert ? 'font-semibold text-destructive' : ''}`}>
        {value}
      </dd>
    </div>
  );
}
