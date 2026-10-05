import Link from 'next/link';
import { ArrowRight, Boxes, Database, FileClock, TriangleAlert } from 'lucide-react';
import { apiFetch } from '@/lib/api-server';
import { ApiState } from '@/components/state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fmtCount } from '@/lib/format';
import type { AssetStats, UserStats } from '@/lib/types';

export const metadata = { title: 'Dashboard · Correnthian admin' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [users, assets] = await Promise.all([
    apiFetch<UserStats>('/users/stats'),
    apiFetch<AssetStats>('/assets/stats'),
  ]);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Accounts, registry health, and anything needing attention.
          </p>
        </div>
      </header>

      <section aria-label="Account metrics">
        <h2 className="sr-only">Accounts</h2>
        <ApiState result={users} render={(d) => (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Accounts" value={fmtCount(d.total)} />
            <Metric label="New (7 days)" value={fmtCount(d.newLast7d)} />
            <Metric label="KYC approved" value={fmtCount(d.byKyc.approved ?? 0)} />
            <Metric
              label="KYC pending"
              value={fmtCount(d.byKyc.pending ?? 0)}
              alert={(d.byKyc.pending ?? 0) > 0}
            />
          </div>
        )} />
      </section>

      <section aria-label="Registry health">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-lg font-medium tracking-tight">Registry</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/assets">Open registry <ArrowRight aria-hidden /></Link>
          </Button>
        </div>
        <ApiState result={assets} render={(d) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Assets registered" value={fmtCount(d.total)} />
              <Metric label="Enabled" value={fmtCount(d.enabled)} />
              <Metric label="Enabled metals" value={fmtCount(d.enabledMetals)} />
              <Metric
                label="Stale attestations"
                value={fmtCount(d.staleAttestations)}
                alert={d.staleAttestations > 0}
              />
            </div>
            {d.staleAttestations > 0 ? (
              <p className="mt-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                <span>
                  {d.staleAttestations} enabled metal
                  {d.staleAttestations === 1 ? ' has' : 's have'} no attestation within 90 days.
                  These are shown to users as backing, so they need refreshing or disabling.
                </span>
              </p>
            ) : null}
          </>
        )} />
      </section>

      <section aria-label="Quick links" className="grid gap-4 sm:grid-cols-3">
        <QuickLink href="/users" icon={<Database aria-hidden />} label="Users"
          detail="Search accounts, inspect devices, change role or status." />
        <QuickLink href="/assets" icon={<Boxes aria-hidden />} label="Assets"
          detail="Registry entries with their backing disclosure." />
        <QuickLink href="/audit" icon={<FileClock aria-hidden />} label="Audit"
          detail="Who did what, and when." />
      </section>
    </>
  );
}

function Metric({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-mono text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {alert ? <CardContent className="pt-0"><Badge variant="destructive">Needs attention</Badge></CardContent> : null}
    </Card>
  );
}

function QuickLink({ href, icon, label, detail }: {
  href: string; icon: React.ReactNode; label: string; detail: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="text-muted-foreground">{icon}</span>
          <Link href={href} className="hover:underline">{label}</Link>
        </div>
        <CardDescription>{detail}</CardDescription>
      </CardHeader>
    </Card>
  );
}
