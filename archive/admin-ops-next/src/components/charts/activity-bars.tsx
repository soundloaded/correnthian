'use client';

import { useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface ActivityPoint {
  /** Day bucket, pre-formatted for the axis. */
  day: string;
  success: number;
  other: number;
}

const SERIES = [
  { key: 'other', label: 'Other outcomes', fill: 'color-mix(in srgb, var(--primary) 40%, transparent)' },
  { key: 'success', label: 'Success', fill: 'var(--primary)' },
] as const;

/**
 * Audit writes per day as stacked bars, split by outcome.
 *
 * Ported from the reference velocity card: same stacked-bar anatomy, same
 * range-toggle shape, real series. The reference compares against a previous
 * period and splits three sales stages; this one splits the two outcome
 * classes the audit trail actually records, and its toggle only narrows the
 * window (7 of the 14 observed days) rather than fetching a new one.
 */
export function ActivityBars({ data }: { data: ActivityPoint[] }) {
  const [days, setDays] = useState<'7' | '14'>('14');
  const visible = days === '7' ? data.slice(-7) : data;
  const total = visible.reduce((n, p) => n + p.success + p.other, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle>Audit activity</CardTitle>
          <CardDescription>
            {total} writes in view · newest 200 rows, UTC days
          </CardDescription>
        </div>
        <Tabs value={days} onValueChange={(v) => setDays(v as '7' | '14')}>
          <TabsList className="h-8">
            <TabsTrigger value="7" className="px-2.5 text-xs">7D</TabsTrigger>
            <TabsTrigger value="14" className="px-2.5 text-xs">14D</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ backgroundColor: s.fill }} aria-hidden />
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </span>
          ))}
        </div>
        <div className="mt-3 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={visible} barSize={18} barGap={2} barCategoryGap="30%">
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              />
              <Tooltip
                cursor={{ fill: 'var(--muted)', opacity: 0.3 }}
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--popover)',
                  fontSize: 12,
                }}
              />
              <Bar dataKey="other" stackId="outcome" fill={SERIES[0].fill} radius={[0, 0, 4, 4]} />
              <Bar dataKey="success" stackId="outcome" fill={SERIES[1].fill} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
