'use client';

import { useActionState, useState } from 'react';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import { decideReviewAction, type ActionState } from '@/app/(dashboard)/actions';
import { Button } from '@/components/ui/button';

/**
 * Per-row approve/reject with a reason. The submit buttons stay disabled
 * until the reason reaches the server's minimum: a decision without a
 * stated reason never fires, on either side of the wire.
 */
export function ReviewActions({ userId }: { userId: string }) {
  const [approveState, approveAction] = useActionState(decideReviewAction, {} as ActionState);
  const [rejectState, rejectAction] = useActionState(decideReviewAction, {} as ActionState);
  const [reason, setReason] = useState('');
  const ready = reason.trim().length >= 8;

  return (
    <div className="space-y-2">
      <label className="block text-xs text-muted-foreground">
        Reason (required, at least 8 characters)
        <input
          name="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="What did the evidence show?"
          className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-sm text-foreground"
        />
      </label>
      <div className="flex items-center gap-2">
        <form action={approveAction} className="contents">
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="decision" value="approve" />
          <input type="hidden" name="reason" value={reason} />
          <Button type="submit" size="sm" variant="outline" disabled={!ready}>
            Approve
          </Button>
        </form>
        <form action={rejectAction} className="contents">
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="decision" value="reject" />
          <input type="hidden" name="reason" value={reason} />
          <Button type="submit" size="sm" variant="destructive" disabled={!ready}>
            Reject
          </Button>
        </form>
      </div>
      <Feedback state={approveState.ok ? approveState : rejectState} />
    </div>
  );
}

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
