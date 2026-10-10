import Link from 'next/link';
import type { Contract } from '@correnthian/contracts';
import { apiFetch } from '@/lib/api-server';
import { ApiState } from '@/components/feedback/api-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fmtDateTime } from '@/lib/format';

type TxDetail = Contract<'GET /api/v1/transactions/:id'>;

export const metadata = { title: 'Transaction · Correnthian admin' };
export const dynamic = 'force-dynamic';

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
      <dt className="shrink-0 text-muted-foreground">{k}</dt>
      <dd className="text-right font-mono text-xs tabular-nums">{children}</dd>
    </div>
  );
}

export default async function TransactionPage({ params }: PageProps<'/transactions/[id]'>) {
  const { id } = await params;
  const result = await apiFetch<TxDetail>(`/transactions/${encodeURIComponent(id)}`);

  return (
    <>
      <header>
        <Link href="/transactions" className="text-sm underline">
          &larr; Transactions
        </Link>
        <h1 className="mt-2 font-mono text-xl font-semibold tracking-tight">{id}</h1>
      </header>

      <ApiState
        result={result}
        render={(t) => (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">State</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="divide-y divide-border">
                  <Row k="State">
                    <Badge variant={t.state === 'failed' ? 'destructive' : 'secondary'}>{t.state}</Badge>
                  </Row>
                  <Row k="Direction">{t.direction}</Row>
                  <Row k="Confirmations">
                    {t.confirmations} / {t.requiredConfirmations} required
                  </Row>
                  <Row k="Drops">{t.dropCount}</Row>
                  <Row k="Next edges">{t.permittedNext.length > 0 ? t.permittedNext.join(', ') : 'none'}</Row>
                  {t.errorCode ? <Row k="Error">{t.errorCode}</Row> : null}
                  {t.errorMessage ? <Row k="Detail">{t.errorMessage}</Row> : null}
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Money and route</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="divide-y divide-border">
                  <Row k="Asset">{t.asset.symbol}</Row>
                  <Row k="Amount (raw)">{t.amountRaw}</Row>
                  <Row k="Amount (USD)">{t.amountUsd === null ? 'unpriced' : t.amountUsd}</Row>
                  <Row k="Fee (raw)">{t.feeRaw ?? '—'}</Row>
                  <Row k="Hash">{t.txHash ?? 'not broadcast yet'}</Row>
                  <Row k="Destination">{t.destination ?? '—'}</Row>
                  <Row k="Wallet">{t.wallet.address}</Row>
                  <Row k="Account">{t.user.email}</Row>
                </dl>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm">Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="divide-y divide-border">
                  <Row k="Created">{fmtDateTime(t.createdAt)}</Row>
                  {t.signedAt ? <Row k="Signed">{fmtDateTime(t.signedAt)}</Row> : null}
                  {t.broadcastAt ? <Row k="Broadcast">{fmtDateTime(t.broadcastAt)}</Row> : null}
                  {t.confirmedAt ? <Row k="Confirmed">{fmtDateTime(t.confirmedAt)}</Row> : null}
                  {t.failedAt ? <Row k="Failed">{fmtDateTime(t.failedAt)}</Row> : null}
                  {t.droppedAt ? <Row k="Last dropped">{fmtDateTime(t.droppedAt)}</Row> : null}
                  {t.expiresAt ? <Row k="Expires">{fmtDateTime(t.expiresAt)}</Row> : null}
                </dl>
              </CardContent>
            </Card>

            {t.metadata !== null && t.metadata !== undefined ? (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-sm">Chain metadata</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
                    {JSON.stringify(t.metadata, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            ) : null}
          </div>
        )}
      />
    </>
  );
}
