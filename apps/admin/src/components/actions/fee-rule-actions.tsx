'use client';

import { useActionState, useState } from 'react';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import {
  createFeeRuleAction, setFeeRuleActiveAction, type ActionState,
} from '@/app/(dashboard)/actions';
import { Button } from '@/components/ui/button';

function Feedback({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <span role="alert" className="inline-flex items-start gap-1 text-xs text-destructive">
        <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden /> {state.error}
      </span>
    );
  }
  if (state.ok) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <CheckCircle2 className="size-3" aria-hidden /> Saved
      </span>
    );
  }
  return null;
}

const inputCls = 'h-8 rounded-md border bg-background px-2 text-sm text-foreground';

/**
 * Create form. The submit stays disabled until every required field and a
 * real reason are present — the server enforces owner role and reason, and
 * this mirrors it instead of discovering it through bounces.
 */
export function FeeRuleCreateForm() {
  const [state, formAction] = useActionState(createFeeRuleAction, {} as ActionState);
  const [operation, setOperation] = useState('');
  const [kind, setKind] = useState('');
  const [basis, setBasis] = useState('');
  const [label, setLabel] = useState('');
  const [rate, setRate] = useState('');
  const [reason, setReason] = useState('');
  const ready =
    operation !== '' && kind !== '' && basis !== '' && label.trim() !== '' && reason.trim().length >= 8;

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="block text-xs text-muted-foreground">
        Operation
        <select name="operation" value={operation} onChange={(e) => setOperation(e.target.value)} className={`${inputCls} mt-1 w-32`}>
          <option value="">Pick</option>
          {['swap', 'buy', 'sell', 'redeem', 'onramp', 'offramp'].map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-muted-foreground">
        Kind
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={`${inputCls} mt-1 w-32`}>
          <option value="">Pick</option>
          {['network', 'provider', 'correnthian'].map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-muted-foreground">
        Basis
        <select name="basis" value={basis} onChange={(e) => setBasis(e.target.value)} className={`${inputCls} mt-1 w-28`}>
          <option value="">Pick</option>
          {['percent', 'fixed', 'spread'].map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-muted-foreground">
        Label
        <input name="label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Standard buy fee" className={`${inputCls} mt-1 w-44`} />
      </label>
      <label className="block text-xs text-muted-foreground">
        Rate (bps, for percent)
        <input name="rateBps" value={rate} onChange={(e) => setRate(e.target.value)} inputMode="numeric" placeholder="50" className={`${inputCls} mt-1 w-28`} />
      </label>
      <label className="block text-xs text-muted-foreground">
        Fixed (USD, for fixed)
        <input name="fixedUsd" placeholder="2.50" className={`${inputCls} mt-1 w-28`} />
      </label>
      <label className="block text-xs text-muted-foreground">
        Reason (required)
        <input name="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this fee changing?" className={`${inputCls} mt-1 w-64`} />
      </label>
      <Button type="submit" size="sm" disabled={!ready}>Create rule</Button>
      <Feedback state={state} />
    </form>
  );
}

/**
 * Per-row enable/disable. The reason travels in the same form so the call
 * cannot fire without one — same rule as creation, same minimum.
 */
export function FeeRuleToggle({ id, active }: { id: string; active: boolean }) {
  const [state, formAction] = useActionState(setFeeRuleActiveAction, {} as ActionState);
  const [reason, setReason] = useState('');
  const ready = reason.trim().length >= 8;

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={String(!active)} />
      <input
        name="reason" value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason"
        aria-label={`Reason for changing rule ${id}`}
        className="h-7 w-32 rounded-md border bg-background px-2 text-xs"
      />
      <Button type="submit" size="sm" variant="outline" disabled={!ready}>
        {active ? 'Disable' : 'Enable'}
      </Button>
      <Feedback state={state} />
    </form>
  );
}
