import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { apiFetch } from '@/lib/api-server';
import { ApiState } from '@/components/feedback/api-state';
import { PageTitle } from '@/components/layout/page-title';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { fmtCount, fmtDate, relativeTime } from '@/lib/format';
import type { KycStatus, UserListResponse } from '@/lib/types';

export const metadata = { title: 'Users · Correnthian admin' };
export const dynamic = 'force-dynamic';

const KYC_STATUSES = [
  'not_started', 'pending', 'approved', 'rejected', 'expired',
] as const satisfies readonly KycStatus[];

/**
 * Tones are a scan aid only. Every badge carries its own word, because a
 * colour-blind operator reading `approved` and `not started` is the disclosure;
 * the colour is not.
 */
const KYC_TONE = {
  approved: 'default',
  pending: 'secondary',
  rejected: 'destructive',
  expired: 'destructive',
  not_started: 'outline',
} as const satisfies Record<KycStatus, 'default' | 'secondary' | 'destructive' | 'outline'>;

const kycLabel = (s: KycStatus): string => s.replace('_', ' ');

/** A hand-edited URL must not put the filter into a state the API rejects. */
const isKycStatus = (v: string): v is KycStatus =>
  (KYC_STATUSES as readonly string[]).includes(v);

export default async function UsersPage({ searchParams }: PageProps<'/users'>) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined): string =>
    (typeof v === 'string' ? v : '').trim();
  const search = one(sp.search);
  const rawKyc = one(sp.kycStatus);
  const kycStatus = isKycStatus(rawKyc) ? rawKyc : '';
  const cursor = one(sp.cursor);

  // The API owns filtering and keyset pagination. The page only forwards it,
  // so the table and the URL always agree about what is on screen.
  const query = new URLSearchParams();
  if (search) query.set('search', search);
  if (kycStatus) query.set('kycStatus', kycStatus);
  if (cursor) query.set('cursor', cursor);

  const result = await apiFetch<UserListResponse>(`/users?${query.toString()}`);
  const filtered = Boolean(search || kycStatus);

  const pageLink = (next: Record<string, string>) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (kycStatus) params.set('kycStatus', kycStatus);
    for (const [k, v] of Object.entries(next)) params.set(k, v);
    return `/users?${params.toString()}`;
  };

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
                <TableHead>Joined</TableHead>
                <TableHead>Last seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.items.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <Link
                      href={`/users/${u.id}`}
                      title={u.email}
                      className="group inline-flex items-center gap-1 font-medium hover:underline"
                    >
                      {u.email}
                      <ChevronRight
                        className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                        aria-hidden
                      />
                    </Link>
                    <div className="font-mono text-xs text-muted-foreground">{u.id}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{u.role}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={KYC_TONE[u.kycStatus]}>{kycLabel(u.kycStatus)}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {fmtCount(u._count.wallets)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {fmtCount(u._count.devices)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {u.country ? `${u.country}${u.region ? ` · ${u.region}` : ''}` : '—'}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {fmtDate(u.createdAt)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {relativeTime(u.lastLoginAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-mono tabular-nums">{fmtCount(d.items.length)}</span>
          {d.nextCursor ? ' on this page · more available' : d.items.length === 1 ? ' account' : ' accounts'}
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
        <PageTitle title="Users">
          Accounts only. Correnthian holds no wallet keys for anyone.
        </PageTitle>

        {/* A GET form, so filtering is server-side and the URL is the state. */}
        <form className="flex flex-wrap items-center gap-2" action="/users" method="get">
          <Input
            name="search"
            type="search"
            defaultValue={search}
            placeholder="Email or display name"
            aria-label="Search accounts by email or display name"
            className="h-8 w-56"
          />
          <Select name="kycStatus" defaultValue={kycStatus || undefined}>
            <SelectTrigger size="sm" className="w-36" aria-label="Filter by KYC status">
              <SelectValue placeholder="Any KYC" />
            </SelectTrigger>
            <SelectContent>
              {KYC_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{kycLabel(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" size="sm" variant="outline">Apply</Button>
          {filtered ? (
            <Button asChild size="sm" variant="ghost">
              <Link href="/users">Clear</Link>
            </Button>
          ) : null}
        </form>
      </header>

      <ApiState
        result={result}
        emptyTitle="No accounts match"
        emptyDescription={
          filtered
            ? 'Adjust the search or the KYC filter, or clear both.'
            : 'No accounts have been created yet.'
        }
        emptyWhen={(d) => d.items.length === 0}
        render={body}
      />
    </>
  );
}