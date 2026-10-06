'use client';

import { useActionState } from 'react';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import {
  setChainEnabledAction, setProviderStatusAction, type ActionState,
} from '@/app/(dashboard)/actions';
import { ConfirmAction } from '@/components/confirm-action';
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

/** Disabling a chain removes it from every client and stops new swaps on it. */
export function ChainActions({ chainId, enabled, name }: {
  chainId: string; enabled: boolean; name: string;
}) {
  return enabled ? (
    <ConfirmAction
      trigger="Disable"
      title={`Disable ${name}?`}
      description="Clients will stop resolving this chain and no new swaps or wallets can be created on it. Existing balances stay on-chain and unaffected."
      confirmLabel={`Disable ${name}`}
      fields={{ chainId, enabled: false }}
      action={setChainEnabledAction}
    />
  ) : (
    <ConfirmAction
      trigger="Enable"
      title={`Enable ${name}?`}
      description="This chain becomes visible and usable again. Confirm the RPC configuration is healthy first — clients resolve it from their own configuration."
      confirmLabel={`Enable ${name}`}
      fields={{ chainId, enabled: true }}
      action={setChainEnabledAction}
    />
  );
}

const PROVIDER_STATUSES = ['active', 'degraded', 'disabled'] as const;

/**
 * Provider status is the switch that decides whether a rail is offered at all,
 * so `degraded` is a first-class choice rather than a note.
 */
export function ProviderActions({ slug, status }: { slug: string; status: string }) {
  const next = status === 'active' ? 'degraded' : 'active';

  return (
    <form className="flex items-center gap-2">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="status" value={next} />
      <ProviderSubmit label={status === 'active' ? 'Mark degraded' : 'Mark active'} />
    </form>
  );
}

function ProviderSubmit({ label }: { label: string }) {
  return (
    <Button type="submit" size="sm" variant="outline">{label}</Button>
  );
}

/** Full status control, for when an operator wants to set it explicitly. */
export function ProviderStatusSelect({ slug }: { slug: string }) {
  const [state, formAction] = useActionState(setProviderStatusAction, {} as ActionState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="slug" value={slug} />
      <select
        name="status"
        className="h-8 rounded-md border bg-background px-2 text-sm"
        defaultValue=""
      >
        <option value="" disabled>set status…</option>
        {PROVIDER_STATUSES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline">Apply</Button>
      <Feedback state={state} />
    </form>
  );
}
