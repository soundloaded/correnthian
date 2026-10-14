import Link from 'next/link';
import { ChevronRight, Search } from 'lucide-react';
import { apiFetch } from '@/lib/api-server';
import { ApiState } from '@/components/feedback/api-state';
import { PageTitle } from '@/components/layout/page-title';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  approved: 'success',
  pending: 'info',
  rejected: 'destructive',
  expired: 'destructive',
  not_started: 'outline',
} as const satisfies Record<KycStatus, 'success' | 'info' | 'destructive' | 'outline'>;

const kycLabel = (s: KycStatus): string => s.replace('_', ' ');

/** Account standing. Suspended is destructive because the account is blocked; closed is outline because it is terminal and needs nothing. */
const STATUS_TONE = {
  active: 'success',
  suspended: 'destructive',
  closed: 'outline',
} as const;

/** A hand-edited URL must not put the filter into a state the API rejects. */
const isKycStatus = (v: string): v is KycStatus =>
  (KYC_STATUSES as readonly string[]).includes(v);

/** Page sizes the API accepts. Anything else falls back to the default. */
const ROW_LIMITS = ['10', '25', '50'] as const;

export default async function UsersPage({ searchParams }: PageProps<'/users'>) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined): string =>
    (typeof v === 'string' ? v : '').trim();
  const search = one(sp.search);
  const rawKyc = one(sp.kycStatus);
  const kycStatus = isKycStatus(rawKyc) ? rawKyc : '';
  const rawLimit = one(sp.limit);
  const limit = (ROW_LIMITS as readonly string[]).includes(rawLimit) ? rawLimit : '25';
  const cursor = one(sp.cursor);

  // The API owns filtering and keyset pagination. The page only forwards it,
  // so the table and the URL always agree about what is on screen.
  const query = new URLSearchParams();
  if (search) query.set('search', search);
  if (kycStatus) query.set('kycStatus', kycStatus);
  query.set('limit', limit);
  if (cursor) query.set('cursor', cursor);

  const result = await apiFetch<UserListResponse>(`/users?${query.toString()}`);
  const filtered = Boolean(search || kycStatus);

  const pageLink = (next: Record<string, string>) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (kycStatus) params.set('kycStatus', kycStatus);
    params.set('limit', limit);
    for (const [k, v] of Object.entries(next)) params.set(k, v);
    return `/users?${params.toString()}`;
  };

  const body = (d: UserListResponse) => (
    <>
      <Card>
        <CardContent className="px-0">
          <Table>            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
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
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-8 shrink-0">
                        <AvatarFallback className="text-xs">
                          {u.email.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <Link
                          href={`/users/${u.id}`}
                          title={u.email}
                          className="group inline-flex items-center gap-1 font-medium hover:underline"
                        >
                          <span className="truncate">{u.email}</span>
                          <ChevronRight
                            className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                            aria-hidden
                          />
                        </Link>
                        <div className="font-mono text-xs text-muted-foreground">{u.id}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{u.role}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={STATUS_TONE[u.status as keyof typeof STATUS_TONE] ?? 'outline'}>
                      {u.status}
                    </Badge>
                  </TableCell>
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
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
      </Card>
    </>
  );

  return (
    <>
      <header>
        <PageTitle title="Users">
          Accounts only. Correnthian holds no wallet keys for anyone.
        </PageTitle>
      </header>

      {/*
        A GET form, so filtering is server-side and the URL is the state.
        It sits in its own toolbar row under the heading: the heading names
        the page, this row operates the table.
      */}
      <form className="flex flex-wrap items-center gap-2" action="/users" method="get">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            name="search"
            type="search"
            defaultValue={search}
            placeholder="Email or display name"
            aria-label="Search accounts by email or display name"
            className="h-8 w-56 pl-8"
          />
        </div>
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
        <Select name="limit" defaultValue={limit}>
          <SelectTrigger size="sm" className="w-28" aria-label="Rows per page">
            <SelectValue placeholder="Rows" />
          </SelectTrigger>
          <SelectContent>
            {ROW_LIMITS.map((n) => (
              <SelectItem key={n} value={n}>{n} / page</SelectItem>
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