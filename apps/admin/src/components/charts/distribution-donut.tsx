'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export interface DistributionSegment {
  name: string;
  value: number;
  color: string;
}

/**
 * One record set as a multi-segment ring with a ranked legend and a top-item
 * callout. Ported from the reference sourced-pipeline card: same ring,
 * legend, and insight-panel anatomy. The reference decorates each row with a
 * trend-vs-previous badge the API cannot supply, so rows here carry shares —
 * measured, not compared.
 */
export function DistributionDonut({
  title,
  description,
  href,
  linkLabel,
  total,
  totalLabel,
  segments,
  insightLabel,
}: {
  title: string;
  description: string;
  href: string;
  linkLabel: string;
  total: number;
  totalLabel: string;
  segments: DistributionSegment[];
  insightLabel: string;
}) {
  const ranked = [...segments].sort((a, b) => b.value - a.value);
  const top = ranked[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <Button asChild size="sm" variant="ghost">
            <Link href={href}>
              {linkLabel}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid items-center gap-5 sm:grid-cols-[auto_1fr] sm:gap-6">
          <div className="relative mx-auto size-36 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ranked}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={60}
                  paddingAngle={3}
                  strokeWidth={0}
                  isAnimationActive={false}
                >
                  {ranked.map((s) => (
                    <Cell key={s.name} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--popover)',
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xs text-muted-foreground">{totalLabel}</span>
              <span className="font-mono text-lg tabular-nums">{total}</span>
            </div>
          </div>
          <div className="min-w-0 space-y-2.5">
            {ranked.map((s) => (
              <div key={s.name} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                  <span className="truncate text-sm capitalize">{s.name.replaceAll('_', ' ')}</span>
                </span>
                <span className="shrink-0 font-mono text-sm text-muted-foreground tabular-nums">
                  {total > 0 ? `${Math.round((100 * s.value) / total)}%` : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
        {top ? (
          <div className="mt-4 border-t pt-3">
            <p className="text-xs text-muted-foreground">{insightLabel}</p>
            <p className="mt-0.5 text-lg font-semibold tracking-tight capitalize">
              {top.name.replaceAll('_', ' ')}{' '}
              <span className="font-mono text-sm font-normal text-muted-foreground tabular-nums">
                {total > 0 ? `${Math.round((100 * top.value) / total)}% of total` : ''}
              </span>
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
