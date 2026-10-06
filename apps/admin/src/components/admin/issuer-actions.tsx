'use client';

import { useActionState, useState } from 'react';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import {
  addIssuerRiskFlagAction, setIssuerTierAction, type ActionState,
} from '@/app/(dashboard)/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function Feedback({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <span role="alert" className="inline-flex items-start gap-1 text-xs text-destructive">
        <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
        {state.error}
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

export function IssuerActions({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Change verification
      </Button>
    );
  }
  return (
    <div className="space-y-3 rounded-md border p-3">
      <TierForm slug={slug} onClose={() => setOpen(false)} />
      <RiskFlagForm slug={slug} />
    </div>
  );
}

/**
 * Promoting to issuer-verified requires a custodian and proof of reserves.
 * The fields are always shown rather than revealed conditionally, so an
 * operator sees what the API will demand before submitting — and a refusal
 * reads as a known rule rather than an arbitrary rejection.
 */
function TierForm({ slug, onClose }: { slug: string; onClose: () => void }) {
  const [state, formAction] = useActionState(setIssuerTierAction, {} as ActionState);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="slug" value={slug} />
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Verification tier
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`tier-${slug}`}>Tier</Label>
          <select
            id={`tier-${slug}`} name="tier"
            className="h-8 w-full rounded-md border bg-background px-2 text-sm"
          >
            <option value="unverified">unverified</option>
            <option value="community_verified">community verified</option>
            <option value="issuer_verified">issuer verified</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`custodian-${slug}`}>Custodian</Label>
          <Input id={`custodian-${slug}`} name="custodian" placeholder="required for issuer_verified" />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`proof-${slug}`}>Proof of reserves URL</Label>
        <Input id={`proof-${slug}`} name="proofOfReserves" placeholder="required for issuer_verified" />
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm">Save tier</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>Close</Button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

/** A risk flag propagates to every asset from this issuer — not reversible from here. */
function RiskFlagForm({ slug }: { slug: string }) {
  const [state, formAction] = useActionState(addIssuerRiskFlagAction, {} as ActionState);

  return (
    <form action={formAction} className="flex items-end gap-2 border-t pt-3">
      <input type="hidden" name="slug" value={slug} />
      <div className="flex-1 space-y-1">
        <Label htmlFor={`flag-${slug}`}>Add risk flag</Label>
        <Input id={`flag-${slug}`} name="flag" placeholder="e.g. attestation-lapsed" />
      </div>
      <Button type="submit" size="sm" variant="outline">Add flag</Button>
      <Feedback state={state} />
    </form>
  );
}
