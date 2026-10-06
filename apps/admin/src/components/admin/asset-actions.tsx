'use client';

import { useActionState, useState } from 'react';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import { recordAttestationAction, setAssetEnabledAction, type ActionState } from '@/app/(dashboard)/actions';
import { ConfirmAction } from '@/components/confirm-action';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

export function AssetActions({ assetId, enabled }: { assetId: string; enabled: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {enabled ? (
        <ConfirmAction
          trigger="Disable"
          title={`Disable ${assetId}?`}
          description="Users will stop seeing this asset in the registry and in swaps. It stays on-chain and balances are unaffected. You can re-enable it later."
          confirmLabel="Disable asset"
          fields={{ assetId, enabled: false }}
          action={setAssetEnabledAction}
        />
      ) : (
        <ConfirmAction
          trigger="Enable"
          title={`Enable ${assetId}?`}
          description="This makes the asset visible to users again and eligible for swaps. Confirm the backing disclosure is accurate first."
          confirmLabel="Enable asset"
          fields={{ assetId, enabled: true }}
          action={setAssetEnabledAction}
        />
      )}
      <AttestationForm assetId={assetId} />
    </div>
  );
}

function AttestationForm({ assetId }: { assetId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(recordAttestationAction, {} as ActionState);

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Record attestation
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex w-full flex-wrap items-end gap-2 rounded-md border p-3">
      <input type="hidden" name="assetId" value={assetId} />
      <div className="space-y-1">
        <Label htmlFor={`at-${assetId}`}>Attested on</Label>
        <Input id={`at-${assetId}`} name="attestedAt" type="date" required />
      </div>
      <div className="min-w-64 flex-1 space-y-1">
        <Label htmlFor={`pu-${assetId}`}>Proof URL</Label>
        <Input id={`pu-${assetId}`} name="proofUrl" placeholder="https://…" />
      </div>
      <Button type="submit" size="sm">Save</Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      <Feedback state={state} />
    </form>
  );
}
