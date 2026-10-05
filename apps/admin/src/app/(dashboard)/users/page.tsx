import Link from 'next/link';
import { apiFetch } from '@/lib/api-server';
import { ApiState } from '@/components/state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { relativeTime } from '@/lib/format';
import type { KycStatus, UserListResponse } from '@/lib/types';

export const metadata = { title: 'Users · Correnthian admin' };
export const dynamic = 'force-dynamic';

const KYC_TONE: Record<KycStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  approved: 'default',
  pending: 'secondary',
  rejected: 'destructive',
  expired: 'destructive',
  not_started: 'outline',
};

export default async function UsersPage({ searchParams }: PageProps<'/users'>) {
  const sp = await searchParams;
  const query = new URLSearchParams();
  if (typeof sp.search === 'string' && sp.search) query.set('search', sp.search);
  if (typeof sp.kycStatus === 'string' && sp.kycStatus) query.set('kycStatus', sp.kycStatus);
  if (typeof sp.cursor === 'string' && sp.cursor) query.set('cursor', sp.cursor);

  const result = await apiFetch<UserListResponse>(`/users?${query.toString()}`);

  const body = (d: UserListResponse) => (
    <>
      <Card>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>KYC</TableHead>
                <TableHead className="text-right">Wallets</TableHead>
                <TableHead className="text-right">Devices</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Last seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.items.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.email}</TableCell>
                  <TableCell><Badge variant="outline">{u.role}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={KYC_TONE[u.kycStatus] ?? 'outline'}>
                      {u.kycStatus.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{u._count.wallets}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{u._count.devices}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {u.country ? `${u.country}${u.region ? ` · ${u.region}` : ''}` : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{relativeTime(u.lastLoginAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {d.nextCursor ? (
        <Link href={`/users?${new URLSearchParams({ ...Object.fromEntries(query), cursor: d.nextCursor }).toString()}`}
              className="text-sm underline">
          Next page
        </Link>
      ) : null}
    </>
  );

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            Accounts only. Correnthian holds no wallet keys for anyone.
          </p>
        </div>
        <form className="flex gap-2" action="/users" method="get">
          <input
            name="search" type="search" placeholder="Email or name"
            className="h-9 w-56 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <select
            name="kycStatus" defaultValue=""
            className="h-9 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Any KYC</option>
            {(['approved', 'pending', 'rejected', 'expired', 'not_started'] as KycStatus[]).map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
        </form>
      </header>

      <ApiState
        result={result}
        emptyTitle="No accounts match"
        emptyDescription="Adjust the filters, or clear the search."
        emptyWhen={(d) => d.items.length === 0}
        render={body}
      />
    </>
  );
}
