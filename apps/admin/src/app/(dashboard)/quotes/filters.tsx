'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * Quote filters.
 *
 * A client component only because `Select` is one. The page stays a server
 * component: filters are query parameters, so the whole surface is a URL, which
 * means an operator can paste the link they are looking at to a colleague.
 */

const STATES = [
  'quoted',
  'awaiting_payment',
  'broadcast',
  'settled',
  'failed',
  'expired',
] as const;

const RAILS = ['provider', 'dex', 'cex', 'otc'] as const;

/** Radix reserves the empty string, so "no filter" is an explicit item. */
const ANY = 'any';

export function QuoteFilters({ state, railKind }: { state: string; railKind: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  /**
   * Rebuilt from scratch on every change rather than merged into the current
   * query: a keyset cursor names a position in one ordering of one filter, and
   * carrying it across a filter change returns a page that looks plausible and
   * is not adjacent to anything the operator was looking at.
   */
  const apply = (next: { state: string; railKind: string }) => {
    const query = new URLSearchParams();
    if (next.state && next.state !== ANY) query.set('state', next.state);
    if (next.railKind && next.railKind !== ANY) query.set('railKind', next.railKind);
    const search = query.toString();
    startTransition(() => router.push(search ? `/quotes?${search}` : '/quotes'));
  };

  const active = state !== '' || railKind !== '';

  return (
    <div className="flex flex-wrap items-center gap-2" aria-busy={pending}>
      <Select
        value={state === '' ? ANY : state}
        onValueChange={(v) => apply({ state: v, railKind })}
      >
        <SelectTrigger size="sm" className="w-44" aria-label="Filter by quote state">
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

      <Select
        value={railKind === '' ? ANY : railKind}
        onValueChange={(v) => apply({ state, railKind: v })}
      >
        <SelectTrigger size="sm" className="w-40" aria-label="Filter by rail">
          <SelectValue placeholder="Any rail" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any rail</SelectItem>
          {RAILS.map((r) => (
            <SelectItem key={r} value={r}>
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {active ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => apply({ state: '', railKind: '' })}
        >
          Clear
        </Button>
      ) : null}
    </div>
  );
}