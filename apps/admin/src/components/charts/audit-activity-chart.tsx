'use client';

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

/**
 * Audit activity over time.
 *
 * Bucketing happens on the server, in the dashboard page, from `GET /audit` —
 * this component only draws the series it is handed. That keeps the client
 * bundle to recharts and nothing else.
 *
 * Neutral, not gold. `--chart-2` is a silver step, and gold is reserved for
 * signalling metal. An audit chart is chrome; it should not compete with an
 * asset that is genuinely synthetic.
 */
const chartConfig = {
  entries: { label: 'Audit entries', color: 'var(--chart-2)' },
} satisfies ChartConfig;

export interface AuditActivityPoint {
  /** Day bucket, pre-formatted for the axis. */
  day: string;
  entries: number;
}

export function AuditActivityChart({ data }: { data: AuditActivityPoint[] }) {
  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <AreaChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={28}
        />
        <YAxis
          width={30}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Area
          dataKey="entries"
          type="monotone"
          stroke="var(--color-entries)"
          strokeWidth={2}
          fill="var(--color-entries)"
          fillOpacity={0.18}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}
