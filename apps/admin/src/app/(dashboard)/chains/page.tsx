import { apiFetch } from '@/lib/api-server';
import { ApiState } from '@/components/feedback/api-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChainActions } from '@/components/actions/registry-actions';
import { fmtCount } from '@/lib/format';
import type { Chain } from '@/lib/types';

export const metadata = { title: 'Chains · Correnthian admin' };
export const dynamic = 'force-dynamic';

/**
 * Chain configuration.
 *
 * There is no RPC column here and there never will be: the API does not return
 * an RPC URL for a chain, so an operator cannot see or edit one from this
 * console. Adding a column for it would mean inventing the value client-side,
 * which is exactly the drift the contracts exist to prevent.
 */
export default async function ChainsPage() {
  const result = await apiFetch<Chain[]>('/chains');

  const body = (chains: Chain[]) => (
    <>
      <Card>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chain</TableHead>
                <TableHead>Family</TableHead>
                <TableHead>Chain ID</TableHead>
                <TableHead className="text-right">Decimals</TableHead>
                <TableHead className="text-right">Assets</TableHead>
                <TableHead className="text-right">Wallets</TableHead>
                <TableHead>Network</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chains.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-medium">{c.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {c.nativeSymbol}
                      {c.explorerUrl ? (
                        <>
                          {' · '}
                          <a
                            href={c.explorerUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="underline"
                          >
                            explorer
                          </a>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{c.family}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{c.id}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{c.decimals}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {fmtCount(c._count.assets)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {fmtCount(c._count.wallets)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.isTestnet ? 'secondary' : 'outline'}>
                      {c.isTestnet ? 'testnet' : 'mainnet'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.enabled ? 'default' : 'outline'}>
                      {c.enabled ? 'enabled' : 'disabled'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <ChainActions chainId={c.id} enabled={c.enabled} name={c.name} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Enabling or disabling a chain changes what clients resolve and where new
        wallets and swaps may be created. It does not touch balances already on-chain,
        and it does not change any RPC endpoint — the API never exposes one.
      </p>
    </>
  );

  return (
    <>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Chains</h1>
        <p className="text-sm text-muted-foreground">
          RPC endpoints are never returned by the API — clients resolve chains from
          their own configuration, so there is nothing here to view or edit.
        </p>
      </header>
      <ApiState
        result={result}
        emptyTitle="No chains configured"
        emptyDescription="Chains are seeded per environment. None are present here."
        emptyWhen={(d) => d.length === 0}
        render={body}
      />
    </>
  );
}