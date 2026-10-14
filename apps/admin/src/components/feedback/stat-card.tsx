import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';

/**
 * One headline counter: a big exact number with its unit beside it.
 *
 * The counter cards on the quotes, transactions, redemptions, and
 * notifications pages were four copies of this block. They render the same
 * shape, so they share it — a fifth copy would be the drift the PageTitle
 * pass already removed once.
 */
export function StatCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-baseline gap-2 py-6">
        <span className="font-mono text-3xl tabular-nums">{value}</span>
        <span className="text-sm text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  );
}
