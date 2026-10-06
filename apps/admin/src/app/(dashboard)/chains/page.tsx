import { apiFetch } from '@/lib/api-server';
import { ApiState } from '@/components/feedback/api-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChainActions } from '@/components/actions/registry-actions';
import type { Chain } from '@/lib/types';

export const metadata = { title: 'Chains · Correnthian admin' };
export const dynamic = 'force-dynamic';

export default async function ChainsPage() {
  const result = await apiFetch<Chain[]>('/chains');

  const body = (chains: Chain[]) => (
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
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {chains.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell><Badge variant="outline">{c.family}</Badge></TableCell>
                <TableCell className="font-mono text-xs">{c.id}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{c.decimals}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{c._count.assets}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{c._count.wallets}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Badge variant={c.enabled ? 'default' : 'outline'}>
                      {c.enabled ? 'enabled' : 'disabled'}
                    </Badge>
                    {c.isTestnet ? <Badge variant="secondary">testnet</Badge> : null}
                  </div>
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
  );

  return (
    <>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Chains</h1>
        <p className="text-sm text-muted-foreground">
          RPC endpoints are never returned by the API — clients resolve chains
          from their own configuration.
        </p>
      </header>
      <ApiState
        result={result}
        emptyTitle="No chains configured"
        emptyWhen={(d) => d.length === 0}
        render={body}
      />
    </>
  );
}
