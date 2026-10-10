'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * Redemption filters. Client-side for the same reason as the quote filters:
 * `Select` is a client component, the page stays a server component, and
 * filters are query parameters so the view is a shareable URL. Changing a
 * filter drops the cursor — a keyset position in one ordering is not a
 * position in another.
 */

const STATES = [
  'requested',
  'kyc_pending',
  'approved',
  'in_production',
  'shipped',
  'delivered',
  'rejected',
  'cancelled',
] as const;

const ANY = 'any';

export function RedemptionFilters({ state }: { state: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const apply = (next: string) => {
    const query = new URLSearchParams();
    if (next && next !== ANY) query.set('state', next);
    const search = query.toString();
    startTransition(() => router.push(search ? `/redemptions?${search}` : '/redemptions'));
  };

  return (
    <div className="flex flex-wrap items-center gap-2" aria-busy={pending}>
      <Select value={state === '' ? ANY : state} onValueChange={apply}>
        <SelectTrigger size="sm" className="w-44" aria-label="Filter by redemption state">
          <SelectValue placeholder="Any state" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any state</SelectItem>
          {STATES.map((s) => (
            <SelectItem key={s} value={s}>
              {s.replace('_', ' ')}
            </SelectItem>
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
