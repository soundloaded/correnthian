import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { apiFetch } from '@/lib/api-server';
import { ApiState } from '@/components/feedback/api-state';
import { UserActions } from '@/components/actions/user-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtCount, fmtDate, fmtDateTime, relativeTime, shortAddress } from '@/lib/format';
import type { UserDetail } from '@/lib/types';

export const metadata = { title: 'Account · Correnthian admin' };
export const dynamic = 'force-dynamic';

const STATUS_TONE = {
  active: 'default',
  suspended: 'destructive',
  closed: 'outline',
} as const;

const KYC_TONE = {
  approved: 'default',
  pending: 'secondary',
  rejected: 'destructive',
  expired: 'destructive',
  not_started: 'outline',
} as const;

type Wallet = UserDetail['wallets'][number];

export default async function UserDetailPage({ params }: PageProps<'/users/[id]'>) {
  const { id } = await params;
  const result = await apiFetch<UserDetail>(`/users/${encodeURIComponent(id)}`);

  const body = (u: UserDetail) => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle>{u.email}</CardTitle>
              <CardDescription>
                {u.displayName ? `${u.displayName} · ` : ''}
                Joined <span className="font-mono">{fmtDate(u.createdAt)}</span> ·
                last seen <span className="font-mono">{relativeTime(u.lastLoginAt)}</span>
              </CardDescription>
            </div>
            <Badge variant={STATUS_TONE[u.status as keyof typeof STATUS_TONE] ?? 'secondary'}>
              {u.status}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Account id">
              <span className="font-mono text-xs break-all">{u.id}</span>
            </Field>
            <Field label="Role"><Badge variant="outline">{u.role}</Badge></Field>
            <Field label="KYC">
              <Badge variant={KYC_TONE[u.kycStatus] ?? 'outline'}>
                {u.kycStatus.replace('_', ' ')}
              </Badge>
            </Field>
            <Field label="Location">
              <span className="font-mono text-xs">
                {u.country ? `${u.country}${u.region ? ` · ${u.region}` : ''}` : '—'}
              </span>
            </Field>
            <Field label="Email verified">
              <span className="font-mono text-xs">
                {u.emailVerifiedAt ? fmtDate(u.emailVerifiedAt) : 'not verified'}
              </span>
            </Field>
            <Field label="Wallets">
              <span className="font-mono tabular-nums">{fmtCount(u._count.wallets)}</span>
            </Field>
            <Field label="Devices">
              <span className="font-mono tabular-nums">{fmtCount(u._count.devices)}</span>
            </Field>
            <Field label="Sessions">
              <span className="font-mono tabular-nums">{fmtCount(u._count.sessions)}</span>
            </Field>
          </dl>

          <Separator />

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              KYC record
            </p>
            {u.kyc ? (
              <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Provider">
                  <span className="font-mono text-xs">{u.kyc.provider ?? '—'}</span>
                </Field>
                <Field label="Provider reference">
                  <span className="font-mono text-xs break-all">{u.kyc.providerRef ?? '—'}</span>
                </Field>
                <Field label="Jurisdiction">
                  <span className="font-mono text-xs">{u.kyc.jurisdiction ?? '—'}</span>
                </Field>
                <Field label="Reviewed">
                  <span className="font-mono text-xs">{fmtDateTime(u.kyc.reviewedAt)}</span>
                </Field>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">
                No KYC record. The account has never been submitted for verification.
              </p>
            )}
          </div>

          <Separator />

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Actions
            </p>
            <UserActions userId={u.id} role={u.role} status={u.status} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registered addresses</CardTitle>
          <CardDescription>
            Public addresses only. Correnthian holds no key for any of them — an address
            here is a record of what the user registered, never custody.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {u.wallets.length === 0 ? (
            <p className="px-4 pb-1 text-sm text-muted-foreground">No addresses registered.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Address</TableHead>
                  <TableHead>Chain</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {u.wallets.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-mono text-xs" title={w.address}>
                      {shortAddress(w.address)}
                      {w.isPrimary ? (
                        <Badge variant="outline" className="ml-2 align-middle">primary</Badge>
                      ) : null}
                      {w.label ? (
                        <span className="ml-2 font-sans text-xs text-muted-foreground">{w.label}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{w.chainId}</TableCell>
                    <TableCell><Badge variant="outline">{w.kind}</Badge></TableCell>
                    <TableCell><Deployment wallet={w} /></TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {fmtDate(w.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Devices</CardTitle>
          <CardDescription>
            Platform and public key only — a device row says nothing about custody.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {u.devices.length === 0 ? (
            <p className="px-4 pb-1 text-sm text-muted-foreground">No active devices.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Trusted</TableHead>
                  <TableHead>Last seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {u.devices.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.label}</TableCell>
                    <TableCell><Badge variant="outline">{d.platform}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{fmtDate(d.trustedAt)}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {relativeTime(d.lastSeenAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link href="/users">
            <ArrowLeft aria-hidden /> Accounts
          </Link>
        </Button>
      </header>
      <ApiState
        result={result}
        emptyTitle="No account"
        emptyDescription="That account id does not resolve to an account."
        render={body}
      />
    </>
  );
}

/**
 * Deployment is an EVM concept: a `smart` account is created off-chain and only
 * becomes real on-chain once the deploy transaction lands. Until that happens
 * the account holds nothing and can sign nothing, so the row says exactly
 * that — it must never read as though an account exists on-chain.
 */
function Deployment({ wallet }: { wallet: Wallet }) {
  if (wallet.kind === 'seed') {
    return <span className="text-xs text-muted-foreground">n/a</span>;
  }
  if (!wallet.deployed) {
    return (
      <Badge
        variant="outline"
        className="text-muted-foreground"
        title="Registered, but the deploy transaction has not confirmed. The account exists on-chain nowhere and cannot hold or move anything."
      >
        not yet
      </Badge>
    );
  }
  return <Badge variant="secondary">deployed</Badge>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}