import Link from 'next/link';
import { apiFetch } from '@/lib/api-server';
import { ApiState } from '@/components/feedback/api-state';
import { PageTitle } from '@/components/layout/page-title';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtCount, fmtDate, relativeTime } from '@/lib/format';
import type { DeviceListResponse, DeviceRow, DeviceStats } from '@/lib/types';

export const metadata = { title: 'Devices · Correnthian admin' };
export const dynamic = 'force-dynamic';

const PLATFORMS = ['ios', 'android', 'web'] as const;

/** A hand-edited URL must not put the filter into a state the API rejects. */
const isPlatform = (v: string): v is (typeof PLATFORMS)[number] =>
  (PLATFORMS as readonly string[]).includes(v);

/**
 * Cross-account view, and the two endpoints it needs.
 *
 * `includeRevoked` is deliberate: a revoked device is soft-deleted precisely so
 * the audit trail survives, and a console that hides them makes revocation
 * unverifiable. The counter row is the reconciliation — `total` counts only
 * live devices, so the sum of what is listed has to be explainable against it.
 */
export default async function DevicesPage({ searchParams }: PageProps<'/devices'>) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined): string =>
    (typeof v === 'string' ? v : '').trim();
  const search = one(sp.search);
  const rawPlatform = one(sp.platform);
  const platform = isPlatform(rawPlatform) ? rawPlatform : '';
  const cursor = one(sp.cursor);

  const query = new URLSearchParams({ includeRevoked: 'true' });
  if (search) query.set('search', search);
  if (platform) query.set('platform', platform);
  if (cursor) query.set('cursor', cursor);

  const [list, stats] = await Promise.all([
    apiFetch<DeviceListResponse>(`/devices/all?${query.toString()}`),
    apiFetch<DeviceStats>('/devices/stats'),
  ]);
  const filtered = Boolean(search || platform);

  const pageLink = (next: Record<string, string>) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (platform) params.set('platform', platform);
    for (const [k, v] of Object.entries(next)) params.set(k, v);
    return `/devices?${params.toString()}`;
  };

  const table = (d: DeviceListResponse) => (
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
                <TableHead>State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.items.map((dev) => (
                <DeviceRowView key={dev.id} device={dev} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-mono tabular-nums">{fmtCount(d.items.length)}</span>
          {d.nextCursor ? ' on this page · more available' : d.items.length === 1 ? ' device' : ' devices'}
        </p>
        {d.nextCursor ? (
          <Button asChild size="sm" variant="outline">
            <Link href={pageLink({ cursor: d.nextCursor })}>Next page</Link>
          </Button>
        ) : null}
      </div>
    </>
  );

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle title="Devices">
          Platform and public key only — a device row proves nothing about custody.
        </PageTitle>

        <form className="flex flex-wrap items-center gap-2" action="/devices" method="get">
          <Input
            name="search"
            type="search"
            defaultValue={search}
            placeholder="Account email"
            aria-label="Search devices by owning account email"
            className="h-8 w-56"
          />
          <Select name="platform" defaultValue={platform || undefined}>
            <SelectTrigger size="sm" className="w-36" aria-label="Filter by platform">
              <SelectValue placeholder="All platforms" />
            </SelectTrigger>
            <SelectContent>
              {PLATFORMS.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" size="sm" variant="outline">Apply</Button>
          {filtered ? (
            <Button asChild size="sm" variant="ghost">
              <Link href="/devices">Clear</Link>
            </Button>
          ) : null}
        </form>
      </header>

      <section aria-label="Device counters" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ApiState
          result={stats}
          render={(s) => (
            <>
              <Counter label="Active devices" value={s.total} />
              <Counter label="Revoked" value={s.revoked} />
              <Counter
                label="Not seen in 90 days"
                value={s.stale}
                alert={s.stale > 0}
                hint="Live but idle. Candidates for revocation."
              />
              <Card size="sm">
                <CardHeader className="pb-1">
                  <CardDescription>Live by platform</CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-3 gap-2">
                    {PLATFORMS.map((p) => (
                      <div key={p}>
                        <dt className="font-mono text-xs text-muted-foreground">{p}</dt>
                        <dd className="font-mono tabular-nums">{fmtCount(s.byPlatform[p] ?? 0)}</dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            </>
          )}
        />
      </section>

      <ApiState
        result={list}
        emptyTitle="No devices match"
        emptyDescription={
          filtered
            ? 'Adjust the search or the platform filter, or clear both.'
            : 'No devices have been registered against any account.'
        }
        emptyWhen={(d) => d.items.length === 0}
        render={table}
      />
    </>
  );
}

/**
 * Revoked devices stay listed, dimmed, and badged. Hiding them would make a
 * revocation impossible to verify — the very thing the audit trail exists for.
 */
function DeviceRowView({ device: dev }: { device: DeviceRow }) {
  return (
    <TableRow className={dev.revokedAt ? 'text-muted-foreground opacity-60' : undefined}>
      <TableCell>
        <div className="font-medium">{dev.label}</div>
        <div className="font-mono text-xs text-muted-foreground">{dev.id}</div>
      </TableCell>
      <TableCell><Badge variant="outline">{dev.platform}</Badge></TableCell>
      <TableCell>
        <Link href="/users" className="hover:underline">{dev.user.email}</Link>
        <div className="text-xs text-muted-foreground">{dev.user.role}</div>
      </TableCell>
      <TableCell className="font-mono text-xs">{fmtDate(dev.trustedAt)}</TableCell>
      <TableCell className="font-mono text-xs">
        <div>{relativeTime(dev.lastSeenAt)}</div>
        {dev.revokedAt ? (
          <div className="text-xs text-muted-foreground">revoked {fmtDate(dev.revokedAt)}</div>
        ) : null}
      </TableCell>
      <TableCell>
        {dev.revokedAt ? <Badge variant="destructive">revoked</Badge> : (
          <span className="font-mono text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}

function Counter({ label, value, alert, hint }: {
  label: string; value: number; alert?: boolean; hint?: string;
}) {
  return (
    <Card size="sm">
      <CardHeader className="pb-1">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-mono text-2xl tabular-nums">{fmtCount(value)}</CardTitle>
        {alert ? <Badge variant="destructive">Needs attention</Badge> : null}
        {hint && !alert ? (
          <p className="text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardHeader>
    </Card>
  );
}