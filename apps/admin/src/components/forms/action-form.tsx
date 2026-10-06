'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import type { ActionState } from '@/app/(dashboard)/actions';

function Submit({ children, variant = 'default', pendingLabel = 'Saving…' }: {
  children: React.ReactNode;
  variant?: 'default' | 'outline' | 'destructive' | 'ghost';
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      data-variant={variant}
      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors disabled:opacity-50
        data-[variant=default]:bg-primary data-[variant=default]:text-primary-foreground
        data-[variant=outline]:border data-[variant=outline]:bg-transparent
        data-[variant=outline]:hover:bg-accent
        data-[variant=destructive]:bg-destructive data-[variant=destructive]:text-white
        data-[variant=ghost]:hover:bg-accent"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

/**
 * Inline mutation form with result feedback.
 *
 * Errors are shown in place rather than as a toast, because a failed
 * permission change that silently disappears is indistinguishable from one
 * that did not happen. Success is stated too — an operator needs to know the
 * write landed.
 */
export function ActionForm({
  action,
  fields,
  submitLabel,
  variant,
  pendingLabel,
  className,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  fields: Record<string, string | number | boolean>;
  submitLabel: string;
  variant?: 'default' | 'outline' | 'destructive' | 'ghost';
  pendingLabel?: string;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, {} as ActionState);

  return (
    <form action={formAction} className={className}>
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={String(v)} />
      ))}
      <Submit variant={variant} pendingLabel={pendingLabel}>{submitLabel}</Submit>
      {state.error ? (
        <span role="alert" className="ml-2 inline-flex items-center gap-1 text-xs text-destructive">
          <TriangleAlert className="size-3" aria-hidden /> {state.error}
        </span>
      ) : null}
      {state.ok ? (
        <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <CheckCircle2 className="size-3" aria-hidden /> Saved
        </span>
      ) : null}
    </form>
  );
}

export { Submit as ActionSubmit };
