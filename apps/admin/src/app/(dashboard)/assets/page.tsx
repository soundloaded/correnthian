import { apiFetch } from '@/lib/api-server';
import { ApiState } from '@/components/feedback/api-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { shortAddress } from '@/lib/format';
import { AssetActions } from '@/components/actions/asset-actions';
import type { AssetSummary } from '@/lib/types';

export const metadata = { title: 'Assets · Correnthian admin' };
export const dynamic = 'force-dynamic';

/**
 * The disclosure panel is not decoration. It is the sentence Correnthian
 * exists to make true, and it must never be elided for a metal — otherwise a
 * synthetic token can reach a user looking like gold.
 *
 * The API returns `{ asset, disclosure }`; everything about the asset itself
 * lives under `asset`.
 */
export default async function AssetsPage({ searchParams }: PageProps<'/assets'>) {
  const sp = await searchParams;
  const category = typeof sp.category === 'string' ? sp.category : '';
  const result = await apiFetch<AssetSummary[]>(`/assets${category ? `?category=${category}` : ''}`);

  const body = (rows: AssetSummary[]) => (
    <div className="space-y-3">
      {rows.map((row) => {
        const a = row.asset;
        return (
          <Card key={a.assetId}>
            <CardContent className="grid gap-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{a.symbol}</span>
                  <span className="text-sm text-muted-foreground">{a.name}</span>
                  <Badge variant={a.enabled ? 'default' : 'outline'}>
                    {a.enabled ? 'enabled' : 'disabled'}
                  </Badge>
                  <Badge variant={a.trust.verifiedTier === 'issuer-verified' ? 'default' : 'secondary'}>
                    {a.trust.verifiedTier}
                  </Badge>
                  {a.backing.custodyModel === 'synthetic' ? (
                    <Badge variant="destructive">synthetic — not metal</Badge>
                  ) : null}
                </div>
                <p className="font-mono text-xs text-muted-foreground">
                  {a.chainId} · {shortAddress(a.contractAddress)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Issuer: {a.issuer.issuerName} · {a.issuer.jurisdiction}
                </p>
                {a.backing.custodian ? (
                  <p className="text-xs text-muted-foreground">
                    Custodian: {a.backing.custodian}
                    {a.backing.vaultLocation.length ? ` · ${a.backing.vaultLocation.join(', ')}` : ''}
                  </p>
                ) : null}
                {a.backing.lastAttestation ? (
                  <p className="font-mono text-xs text-muted-foreground">
                    Attested {a.backing.lastAttestation}
                  </p>
                ) : (
                  <p className="font-mono text-xs text-destructive">never attested</p>
                )}
                {a.trust.riskFlags.length ? (
                  <p className="font-mono text-xs text-destructive">
                    flags: {a.trust.riskFlags.join(', ')}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1 rounded-md bg-muted/40 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Shown to users
                </p>
                <p className="text-sm">{row.disclosure}</p>
              </div>
              <div className="lg:col-span-2">
                <AssetActions assetId={a.assetId} enabled={a.enabled} />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Asset registry</h1>
          <p className="text-sm text-muted-foreground">
            Every entry carries the disclosure shown to users.
          </p>
        </div>
        <form action="/assets" method="get">
          <select
            name="category"
            defaultValue={category}
            className="h-9 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">All categories</option>
            {['metal', 'stablecoin', 'crypto', 'treasury', 'fund'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </form>
      </header>

      <ApiState
        result={result}
        emptyTitle="Registry is empty"
        emptyDescription="Assets appear here once registered through the API."
        emptyWhen={(d) => d.length === 0}
        render={body}
      />
    </>
  );
}
