'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * Audit filters.
 *
 * `action` is free text rather than a dropdown on purpose. The list is filtered
 * server-side by exact action, so a dropdown can only offer the actions on the
 * page it is filtering — pick `asset.enabled` and the next menu contains
 * `asset.enabled` and nothing else, which is a dead end. A text field has no
 * such trap, and an investigator looking for one action usually knows its name.
 */

const OUTCOMES = ['success', 'failure', 'denied'] as const;
const ANY = 'any';

export function AuditFilters({ action, outcome }: { action: string; outcome: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState(action);

  const push = (next: { action: string; outcome: string }) => {
    const query = new URLSearchParams();
    if (next.action) query.set('action', next.action);
    if (next.outcome && next.outcome !== ANY) query.set('outcome', next.outcome);
    const search = query.toString();
    startTransition(() => router.push(search ? `/audit?${search}` : '/audit'));
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    push({ action: draft.trim(), outcome });
  };

  return (
    <div className="flex flex-wrap items-center gap-2" aria-busy={pending}>
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Action, e.g. asset.enabled"
          aria-label="Filter by action"
          className="h-8 w-64 font-mono"
        />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          <Search aria-hidden />
          Filter
        </Button>
      </form>

      <Select
        value={outcome === '' ? ANY : outcome}
        onValueChange={(v) => push({ action, outcome: v })}
      >
        <SelectTrigger size="sm" className="w-36" aria-label="Filter by outcome">
          <SelectValue placeholder="Any outcome" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any outcome</SelectItem>
          {OUTCOMES.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {action || outcome ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => {
            setDraft('');
            push({ action: '', outcome: '' });
          }}
        >
          Clear
        </Button>
      ) : null}
    </div>
  );
}