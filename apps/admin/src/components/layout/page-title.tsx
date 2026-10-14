import type { ReactNode } from "react";

/**
 * One page heading: title plus its one-line remit. Every console page opens
 * with this so the level, spacing, and description treatment stay identical
 * without sixteen copies of the same classes to drift apart.
 */
export function PageTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children ? <p className="text-sm text-muted-foreground">{children}</p> : null}
    </div>
  );
}
