'use client';

import { useActionState } from 'react';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import { runJobAction, type ActionState } from '@/app/(dashboard)/actions';
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
        <CheckCircle2 className="size-3" aria-hidden /> Ran
      </span>
    );
  }
  return null;
}

/**
 * Manual run. A native confirm stands between the click and the call: a
 * run executes the job against live vendors and spends real quota, which
 * is an operator act, not a stray click.
 */
export function JobRunButton({ name }: { name: string }) {
  const [state, formAction] = useActionState(runJobAction, {} as ActionState);

  return (
    <form
      action={formAction}
      className="flex items-center gap-2"
      onSubmit={(e) => {
        if (!window.confirm(`Run ${name} now? It executes against live vendors.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="name" value={name} />
      <Button type="submit" size="sm" variant="outline">Run now</Button>
      <Feedback state={state} />
    </form>
  );
}
