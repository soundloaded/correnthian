'use client';

import { useActionState, useState } from 'react';
import type { ActionState } from '@/app/(dashboard)/actions';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * A destructive change, behind an explicit confirmation.
 *
 * AlertDialog rather than Dialog: these actions remove a chain, disable a
 * metal, or suspend an account, and a mis-click must not be able to do that.
 */
export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel,
  fields,
  action,
}: {
  trigger: string;
  title: string;
  description: string;
  confirmLabel: string;
  fields: Record<string, string | boolean>;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, {} as ActionState);

  const close = () => {
    setOpen(false);
    // Clear a previous error so reopening does not show stale feedback.
    if (state.error || state.ok) formAction(new FormData());
  };

  return (
    <>
      <Button size="sm" variant="destructive" onClick={() => setOpen(true)}>
        {trigger}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <form action={formAction}>
            {Object.entries(fields).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={String(v)} />
            ))}
            <AlertDialogHeader>
              <AlertDialogTitle>{title}</AlertDialogTitle>
              <AlertDialogDescription>{description}</AlertDialogDescription>
            </AlertDialogHeader>
            {state.error ? (
              <p role="alert" className="text-sm text-destructive">{state.error}</p>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel onClick={close}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={close}
              >
                {confirmLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
