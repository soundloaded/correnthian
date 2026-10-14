'use client';

import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

/**
 * One-ring health donut: `value` of `total`, center-labelled.
 *
 * Gold arc, muted track. Gold here is metal signalling done right — this
 * ring answers "how much of the metal backing is currently attested", the
 * exact question the accent exists for. Anything else wanting a donut gets
 * the silver ramp instead.
 */
export function HealthDonut({ value, total }: { value: number; total: number }) {
  const data = [
    { name: 'current', value: Math.max(value, 0) },
    { name: 'remainder', value: Math.max(total - value, 0) },
  ];
  const pct = total > 0 ? Math.round((100 * Math.max(value, 0)) / total) : 0;

  return (
    <div className="relative size-36 shrink-0" role="img" aria-label={`${pct}% current`}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="78%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
            strokeWidth={0}
            isAnimationActive={false}
          >
            <Cell fill="var(--gold)" />
            <Cell fill="var(--muted)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <p className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-2xl tabular-nums">{pct}%</span>
        <span className="text-[11px] text-muted-foreground">current</span>
      </p>
    </div>
  );
}
