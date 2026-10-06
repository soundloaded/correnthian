import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { apiFetch } from '@/lib/api-server';
import { ApiState } from '@/components/state';
import { UserActions } from '@/components/admin/user-actions';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtDate, relativeTime, shortAddress } from '@/lib/format';
import type { UserDetail } from '@/lib/types';

export const metadata = { title: 'Account · Correnthian admin' };
export const dynamic = 'force-dynamic';

export default async function UserDetailPage({ params }: PageProps<'/users/[id]'>) {
  const { id } = await params;
  const result = await apiFetch<UserDetail>(`/users/${encodeURIComponent(id)}`);

  const body = (u: UserDetail) => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">{u.email}</CardTitle>
              <CardDescription>
                Joined {fmtDate(u.createdAt)} · last seen {relativeTime(u.lastLoginAt)}
              </CardDescription>
            </div>
            <Badge variant={u.status === 'active' ? 'default' : 'destructive'}>{u.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-4">
            <Field label="Role"><Badge variant="outline">{u.role}</Badge></Field>
            <Field label="KYC">
              <Badge variant={u.kycStatus === 'approved' ? 'default' : 'secondary'}>
                {u.kycStatus.replace('_', ' ')}
              </Badge>
            </Field>
            <Field label="Location">
              <span className="font-mono text-xs">
                {u.country ? `${u.country}${u.region ? ` · ${u.region}` : ''}` : '—'}
              </span>
            </Field>
            <Field label="Email verified">{u.emailVerifiedAt ? fmtDate(u.emailVerifiedAt) : 'no'}</Field>
          </dl>

          <div className="border-t pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Actions
            </p>
            <UserActions userId={u.id} role={u.role} status={u.status} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registered addresses</CardTitle>
          <CardDescription>
            Public addresses only. Correnthian holds no key for any of them.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {u.wallets.length === 0 ? (
            <p className="px-6 pb-4 text-sm text-muted-foreground">No addresses registered.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Address</TableHead>
                  <TableHead>Chain</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Deployed</TableHead>
                  <TableHead>Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {u.wallets.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-mono text-xs" title={w.address}>
                      {shortAddress(w.address)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{w.chainId}</TableCell>
                    <TableCell><Badge variant="outline">{w.kind}</Badge></TableCell>
                    <TableCell className="text-xs">
                      {w.kind === 'seed' ? 'n/a' : w.deployed ? 'yes' : 'not yet'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{fmtDate(w.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Devices</CardTitle>
          <CardDescription>Platform and public key only — never key material.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {u.devices.length === 0 ? (
            <p className="px-6 pb-4 text-sm text-muted-foreground">No active devices.</p>
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
                    <TableCell className="text-muted-foreground">{relativeTime(d.lastSeenAt)}</TableCell>
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
        <Link href="/users" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> Accounts
        </Link>
      </header>
      <ApiState
        result={result}
        emptyTitle="No account"
        render={body}
      />
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
