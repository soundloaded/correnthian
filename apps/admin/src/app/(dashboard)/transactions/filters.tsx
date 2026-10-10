'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * Transaction filters. State and direction are selects; the wallet is a
 * free-text id because an operator pastes it from elsewhere. Changing any
 * filter drops the cursor — same keyset reasoning as every other table.
 */

const STATES = [
  'created', 'signed', 'broadcast', 'pending', 'confirmed', 'failed', 'cancelled', 'expired',
] as const;

const DIRECTIONS = ['in', 'out', 'internal'] as const;

const ANY = 'any';

export function TransactionFilters({ state, direction, walletId }: {
  state: string; direction: string; walletId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [wallet, setWallet] = useState(walletId);

  const apply = (next: { state: string; direction: string; walletId: string }) => {
    const query = new URLSearchParams();
    if (next.state && next.state !== ANY) query.set('state', next.state);
    if (next.direction && next.direction !== ANY) query.set('direction', next.direction);
    if (next.walletId) query.set('walletId', next.walletId);
    const search = query.toString();
    startTransition(() => router.push(search ? `/transactions?${search}` : '/transactions'));
  };

  const active = state !== '' || direction !== '' || walletId !== '';

  return (
    <div className="flex flex-wrap items-center gap-2" aria-busy={pending}>
      <Select value={state === '' ? ANY : state} onValueChange={(v) => apply({ state: v, direction, walletId })}>
        <SelectTrigger size="sm" className="w-36" aria-label="Filter by transaction state">
          <SelectValue placeholder="Any state" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any state</SelectItem>
          {STATES.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={direction === '' ? ANY : direction}
        onValueChange={(v) => apply({ state, direction: v, walletId })}
      >
        <SelectTrigger size="sm" className="w-32" aria-label="Filter by direction">
          <SelectValue placeholder="Any direction" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any direction</SelectItem>
          {DIRECTIONS.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          apply({ state, direction, walletId: wallet.trim() });
        }}
      >
        <input
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          placeholder="Wallet id"
          aria-label="Filter by wallet id"
          className="h-8 w-44 rounded-md border bg-background px-2 font-mono text-xs"
        />
        <Button type="submit" size="sm" variant="outline">Filter</Button>
      </form>
      {active ? (
        <Button size="sm" variant="ghost" onClick={() => { setWallet(''); apply({ state: '', direction: '', walletId: '' }); }}>
          Clear
        </Button>
      ) : null}
    </div>
  );
}
