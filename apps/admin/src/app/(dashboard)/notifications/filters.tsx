'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * Notification state filter. Pending/sent/failed is derived from the
 * timestamps server-side — the filter names the derivation, not a column.
 * Changing it drops the cursor, like every other keyset table.
 */

const STATES = ['pending', 'sent', 'failed'] as const;
const ANY = 'any';

export function NotificationFilters({ state }: { state: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const apply = (next: string) => {
    const query = new URLSearchParams();
    if (next && next !== ANY) query.set('state', next);
    const search = query.toString();
    startTransition(() => router.push(search ? `/notifications?${search}` : '/notifications'));
  };

  return (
    <div className="flex flex-wrap items-center gap-2" aria-busy={pending}>
      <Select value={state === '' ? ANY : state} onValueChange={apply}>
        <SelectTrigger size="sm" className="w-40" aria-label="Filter by delivery state">
          <SelectValue placeholder="Any state" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any state</SelectItem>
          {STATES.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {state !== '' ? (
        <Button size="sm" variant="ghost" onClick={() => apply('')}>
          Clear
        </Button>
      ) : null}
    </div>
  );
}
