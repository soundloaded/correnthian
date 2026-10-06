'use client';

import { useActionState } from 'react';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import {
  changeUserRoleAction, changeUserStatusAction, type ActionState,
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

const ROLES = ['user', 'support', 'compliance', 'admin', 'owner'] as const;

export function UserActions({ userId, role, status }: {
  userId: string; role: string; status: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <RoleForm userId={userId} role={role} />
      <StatusForm userId={userId} status={status} />
    </div>
  );
}

function RoleForm({ userId, role }: { userId: string; role: string }) {
  const [state, formAction] = useActionState(changeUserRoleAction, {} as ActionState);
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <select
        name="role" defaultValue={role}
        className="h-8 rounded-md border bg-background px-2 text-sm"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline">Set role</Button>
      <Feedback state={state} />
    </form>
  );
}

/**
 * Suspension blocks sign-in. It is stated plainly here because it is the
 * action an operator is most likely to apply by mistake.
 */
function StatusForm({ userId, status }: { userId: string; status: string }) {
  const [state, formAction] = useActionState(changeUserStatusAction, {} as ActionState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <select
        name="status" defaultValue={status}
        className="h-8 rounded-md border bg-background px-2 text-sm"
      >
        {['active', 'suspended', 'closed'].map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline">Set status</Button>
      <Feedback state={state} />
    </form>
  );
}
