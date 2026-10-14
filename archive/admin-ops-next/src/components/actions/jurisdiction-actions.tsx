'use client';

import { useActionState, useState } from 'react';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import { updateJurisdictionRuleAction, type ActionState } from '@/app/(dashboard)/actions';
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

const FLAGS = [
  'canBuyCrypto',
  'canSellCrypto',
  'canUseMetals',
  'canRedeem',
  'kycRequired',
  'active',
] as const;

const SHORT: Record<string, string> = {
  canBuyCrypto: 'Buy',
  canSellCrypto: 'Sell',
  canUseMetals: 'Metals',
  canRedeem: 'Redeem',
  kycRequired: 'KYC',
  active: 'Active',
};

/**
 * Per-row flag editor. Every flag submits explicitly via native selects —
 * an unchecked checkbox would submit nothing and read as "leave alone",
 * which is the wrong semantics for a toggle. The submit stays disabled
 * until a real reason is typed; the server remains the gate.
 */
export function JurisdictionRuleForm({ id, rule }: {
  id: string;
  rule: Record<string, boolean>;
}) {
  const [state, formAction] = useActionState(updateJurisdictionRuleAction, {} as ActionState);
  const [reason, setReason] = useState('');
  const ready = reason.trim().length >= 8;

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      {FLAGS.map((f) => (
        <label key={f} className="text-xs text-muted-foreground">
          {SHORT[f]}
          <select
            name={f}
            defaultValue={rule[f] ? 'true' : 'false'}
            className="ml-1 h-7 rounded-md border bg-background px-1 text-xs text-foreground"
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
      ))}
      <input
        name="reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (required)"
        aria-label="Reason for changing this rule"
        className="h-7 w-40 rounded-md border bg-background px-2 text-xs"
      />
      <Button type="submit" size="sm" variant="outline" disabled={!ready}>
        Save
      </Button>
      <Feedback state={state} />
    </form>
  );
}
