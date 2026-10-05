import Link from 'next/link';
import { apiFetch } from '@/lib/api-server';
import { ApiState } from '@/components/state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtDate, relativeTime } from '@/lib/format';
import type { DeviceListResponse } from '@/lib/types';

export const metadata = { title: 'Devices · Correnthian admin' };
export const dynamic = 'force-dynamic';

export default async function DevicesPage({ searchParams }: PageProps<'/devices'>) {
  const sp = await searchParams;
  const query = new URLSearchParams();
  if (typeof sp.search === 'string' && sp.search) query.set('search', sp.search);
  if (typeof sp.platform === 'string' && sp.platform) query.set('platform', sp.platform);
  if (typeof sp.cursor === 'string' && sp.cursor) query.set('cursor', sp.cursor);

  const result = await apiFetch<DeviceListResponse>(`/devices/all?${query.toString()}`);

  const body = (d: DeviceListResponse) => (
    <>
      <Card>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Trusted</TableHead>
                <TableHead>Last seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.items.map((dev) => (
                <TableRow key={dev.id} className={dev.revokedAt ? 'opacity-60' : undefined}>
                  <TableCell className="font-medium">{dev.label}</TableCell>
                  <TableCell><Badge variant="outline">{dev.platform}</Badge></TableCell>
                  <TableCell>
                    <Link href="/users" className="hover:underline">{dev.user.email}</Link>
                    <div className="text-xs text-muted-foreground">{dev.user.role}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{fmtDate(dev.trustedAt)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {dev.revokedAt ? <Badge variant="destructive">revoked</Badge> : relativeTime(dev.lastSeenAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {d.nextCursor ? (
        <Link
          href={`/devices?${new URLSearchParams({ ...Object.fromEntries(query), cursor: d.nextCursor }).toString()}`}
          className="text-sm underline"
        >
          Next page
        </Link>
      ) : null}
    </>
  );

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Devices</h1>
          <p className="text-sm text-muted-foreground">
            Platform and public key only — a device row proves nothing about
            custody.
          </p>
        </div>
        <form className="flex gap-2" action="/devices" method="get">
          <input
            name="search" type="search" placeholder="Account email"
            className="h-9 w-56 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <select
            name="platform" defaultValue=""
            className="h-9 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">All platforms</option>
            {['ios', 'android', 'web'].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </form>
      </header>

      <ApiState
        result={result}
        emptyTitle="No devices match"
        emptyDescription="Adjust the filters, or clear the search."
        emptyWhen={(d) => d.items.length === 0}
        render={body}
      />
    </>
  );
}
