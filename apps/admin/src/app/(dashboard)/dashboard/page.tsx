import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  PlugZap,
  ShieldCheck,
  TriangleAlert,
  UserRoundCheck,
  UserPlus,
  Users,
  Vault,
  type LucideIcon,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-server';
import { ApiState } from '@/components/feedback/api-state';
import { PageTitle } from '@/components/layout/page-title';
import { AuditActivityChart, type AuditActivityPoint } from '@/components/charts/audit-activity-chart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { fmtCount, fmtDateTime, relativeTime } from '@/lib/format';
import type { AssetStats, AuditRow, Provider, UserStats } from '@/lib/types';

export const metadata = { title: 'Dashboard · Correnthian admin' };
export const dynamic = 'force-dynamic';

/** The chart window. The API caps a single audit page at 200 rows. */
const CHART_DAYS = 14;
const RECENT_ROWS = 12;

export default async function DashboardPage() {
  const [users, assets, audit, providers] = await Promise.all([
    apiFetch<UserStats>('/users/stats'),
    apiFetch<AssetStats>('/assets/stats'),
    apiFetch<AuditRow[]>('/audit?limit=200'),
    apiFetch<Provider[]>('/providers'),
  ]);

  const activity = audit.status === 'ok' ? bucketByDay(audit.data, CHART_DAYS) : [];
  const attention = buildAttention({ users, assets, providers });

  return (
    <>
      <header>
        <PageTitle title="Dashboard">
          Accounts, registry health, and anything needing attention.
        </PageTitle>
      </header>

      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <ApiState result={users} render={(d) => (
          <>
            <Metric label="Accounts" value={fmtCount(d.total)} icon={Users} />
            <Metric label="New in 7 days" value={fmtCount(d.newLast7d)} icon={UserPlus} />
            <Metric
              label="KYC pending"
              value={fmtCount(d.byKyc.pending ?? 0)}
              icon={UserRoundCheck}
              alert={(d.byKyc.pending ?? 0) > 0}
            />
          </>
        )} />
        <ApiState result={assets} render={(d) => (
          <>
            <Metric label="Assets registered" value={fmtCount(d.total)} icon={Boxes} />
            <Metric label="Enabled metals" value={fmtCount(d.enabledMetals)} icon={Vault} metal />
            <Metric
              label="Stale attestations"
              value={fmtCount(d.staleAttestations)}
              icon={TriangleAlert}
              alert={d.staleAttestations > 0}
            />
          </>
        )} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Needs attention</CardTitle>
          <CardDescription>
            Each item links to the page where it can be resolved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {attention.items.length === 0 ? (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                Nothing outstanding in the sections that could be read.
                {attention.unread.length ? ' See the coverage note below.' : null}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col">
              {attention.items.map((item, i) => (
                <li key={item.href}>
                  {i > 0 ? <Separator className="my-3" /> : null}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <item.icon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.detail}</p>
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline" className="shrink-0">
                      <Link href={item.href}>
                        {item.cta}
                        <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {/*
            A partial read is not an all-clear. Saying "nothing outstanding"
            after the KYC counter failed would be asserting something this page
            never established.
          */}
          {attention.unread.length ? (
            <>
              {attention.items.length > 0 ? <Separator className="my-3" /> : null}
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <PlugZap className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  Not checked, because the request failed: {attention.unread.join(', ')}.
                  {attention.items.length === 0
                    ? ' This is not an all-clear.'
                    : null}
                </span>
              </p>
            </>
          ) : null}
        </CardContent>
      </Card>

      <section aria-label="Audit activity" className="flex flex-col gap-4">
        <ApiState
          result={audit}
          emptyTitle="No audit entries yet"
          emptyDescription="Every write the admin performs is recorded here. Nothing has been written yet."
          emptyWhen={(d) => d.length === 0}
          render={(rows) => (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Audit activity</CardTitle>
                  <CardDescription>
                    Entries per day over the last {CHART_DAYS} days, derived from{' '}
                    <span className="font-mono">GET /audit</span>. The API returns
                    the newest 200 rows, so a busier period shows the tail of that
                    window rather than the full history.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AuditActivityChart data={activity} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent activity</CardTitle>
                  <CardDescription>The {RECENT_ROWS} most recent audit entries.</CardDescription>
                  <CardAction>
                    <Button asChild size="sm" variant="ghost">
                      <Link href="/audit">
                        Full audit trail
                        <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[11rem]">When</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Actor</TableHead>
                        <TableHead className="w-[9rem]">Outcome</TableHead>
                        <TableHead>Target</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.slice(0, RECENT_ROWS).map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-mono text-xs whitespace-nowrap">
                            <span title={fmtDateTime(row.createdAt)}>{relativeTime(row.createdAt)}</span>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{row.action}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {row.actorId ? (
                              <>
                                <span className="font-mono">{row.actorId}</span>
                                {row.actorRole ? (
                                  <span className="ml-1 text-muted-foreground">({row.actorRole})</span>
                                ) : null}
                              </>
                            ) : (
                              'system'
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={row.outcome === 'success' ? 'secondary' : 'destructive'}>
                              {row.outcome}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {row.targetType && row.targetId
                              ? `${row.targetType} · ${row.targetId}`
                              : (row.targetType ?? '—')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        />
      </section>
    </>
  );
}

/**
 * One headline number with its icon. Adapted from the template's KPI card
 * minus the two things it could not honestly carry here: gradient icon boxes
 * (one accent per card spends the brand) and change-vs-previous-period
 * badges (the API serves no previous period, so any delta would be
 * invented). The metal card alone carries gold, for the reason the theme
 * states. Dotted texture is a silver dot at 7% — paper, not decoration.
 */
function Metric({
  label, value, icon: Icon, alert, metal,
}: {
  label: string; value: string; icon: LucideIcon; alert?: boolean; metal?: boolean;
}) {
  return (
    <Card className="relative overflow-hidden bg-[radial-gradient(rgb(200_205_212/0.07)_1px,transparent_1px)] [background-size:16px_16px]">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardDescription>{label}</CardDescription>
        <div
          className={
            metal
              ? 'flex size-10 shrink-0 items-center justify-center rounded-lg border border-gold/40 bg-gold/10 text-gold'
              : 'flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground'
          }
        >
          <Icon className="size-5" aria-hidden />
        </div>
      </CardHeader>
      <CardContent>
        <p className="font-mono text-2xl tabular-nums">{value}</p>
        {alert ? (
          <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-destructive">
            <TriangleAlert className="size-4" aria-hidden />
            Needs attention
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

interface AttentionItem {
  href: string;
  cta: string;
  title: string;
  detail: string;
  icon: LucideIcon;
}

interface Attention {
  items: AttentionItem[];
  /** Named checks whose counter could not be read. Never an all-clear. */
  unread: string[];
}

/**
 * Everything on this page that an operator can act on today.
 *
 * Only a counter that actually read successfully can raise an item, and each
 * item carries the link to the page that fixes it — a warning an operator
 * cannot act on is a warning they learn to ignore.
 */
function buildAttention({
  users,
  assets,
  providers,
}: {
  users: Awaited<ReturnType<typeof apiFetch<UserStats>>>;
  assets: Awaited<ReturnType<typeof apiFetch<AssetStats>>>;
  providers: Awaited<ReturnType<typeof apiFetch<Provider[]>>>;
}): Attention {
  const items: AttentionItem[] = [];
  const unread: string[] = [];

  if (assets.status !== 'ok') unread.push('stale attestations');

  if (assets.status === 'ok' && assets.data.staleAttestations > 0) {
    const n = assets.data.staleAttestations;
    items.push({
      href: '/assets',
      cta: 'Refresh attestations',
      title: `${n} enabled metal${n === 1 ? '' : 's'} without a current attestation`,
      detail:
        'Users are shown this metal as backing. Record a fresh attestation, or disable the asset until one exists.',
      icon: BadgeCheck,
    });
  }

  if (providers.status !== 'ok') unread.push('provider health');

  if (providers.status === 'ok') {
    const degraded = providers.data.filter((p) => p.status === 'degraded');
    if (degraded.length > 0) {
      const n = degraded.length;
      items.push({
        href: '/providers',
        cta: 'Check providers',
        title: `${n} provider${n === 1 ? '' : 's'} degraded`,
        detail: `Degraded: ${degraded.map((p) => p.name).join(', ')}. Quotes through ${n === 1 ? 'this provider' : 'these providers'} may be failing or stale.`,
        icon: PlugZap,
      });
    }
  }

  if (users.status !== 'ok') unread.push('the KYC queue');

  if (users.status === 'ok' && (users.data.byKyc.pending ?? 0) > 0) {
    const n = users.data.byKyc.pending ?? 0;
    items.push({
      href: '/users',
      cta: 'Review KYC queue',
      title: `${n} account${n === 1 ? '' : 's'} awaiting KYC`,
      detail: 'These accounts cannot transact until identity verification is decided.',
      icon: UserRoundCheck,
    });
  }

  return { items, unread };
}

/**
 * Audit rows into one bucket per day for the last `days` days.
 *
 * Bucketing is by UTC date because `createdAt` is an ISO instant and the API
 * gives no local-timezone context; bucketing in the operator's zone would make
 * the same row land in a different column depending on who is looking.
 */
function bucketByDay(rows: AuditRow[], days: number): AuditActivityPoint[] {
  const buckets = new Map<string, number>();
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    buckets.set(new Date(today - offset * 86_400_000).toISOString().slice(0, 10), 0);
  }

  for (const row of rows) {
    const key = row.createdAt.slice(0, 10);
    const current = buckets.get(key);
    if (current !== undefined) buckets.set(key, current + 1);
  }

  return [...buckets.entries()].map(([day, entries]) => ({
    day: new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      timeZone: 'UTC',
    }),
    entries,
  }));
}
