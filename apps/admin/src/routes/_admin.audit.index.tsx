import * as React from "react"
import { createFileRoute } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { AuditHeader } from "@/components/audit/audit-header"
import { AuditTable } from "@/components/audit/audit-table"
import { AuditToolbar } from "@/components/audit/audit-toolbar"
import { useApiQuery } from "@/lib/use-api-query"

export const Route = createFileRoute("/_admin/audit/")({
  component: AuditPage,
})

const PAGE_LIMIT = 200

// No keyset here: the endpoint takes action/outcome/requestId + limit and
// no cursor, so filters refetch a capped newest-first list. The toolbar is
// local state (URL-is-state is for cheap filters; three free-text fields
// that refetch on submit gain nothing from the URL bar).
export function useAuditList() {
  const [action, setAction] = React.useState("")
  const [outcome, setOutcome] = React.useState("all")
  const [requestId, setRequestId] = React.useState("")

  const debouncedAction = useDebouncedValue(action, 300)
  const debouncedRequestId = useDebouncedValue(requestId, 300)

  const query = useApiQuery("GET /api/v1/audit", undefined, {
    action: debouncedAction.trim() === "" ? undefined : debouncedAction.trim(),
    outcome: outcome === "all" ? undefined : outcome,
    requestId: debouncedRequestId.trim() === "" ? undefined : debouncedRequestId.trim(),
    limit: PAGE_LIMIT,
  })

  return {
    rows: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    toolbar: (
      <AuditToolbar
        action={action}
        onActionChange={setAction}
        outcome={outcome}
        onOutcomeChange={setOutcome}
        requestId={requestId}
        onRequestIdChange={setRequestId}
      />
    ),
  }
}

function AuditPage() {
  const audit = useAuditList()

  return (
    <div className="flex flex-1 flex-col gap-6">
      <AuditHeader shown={audit.isLoading || audit.isError ? null : audit.rows.length} />

      {audit.toolbar}

      {audit.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading audit trail…</p>
      ) : audit.isError ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-8">
          <p className="text-sm font-medium">Could not load the audit trail</p>
          <p className="text-sm text-muted-foreground">
            The API did not answer. The trail below may be stale or empty —
            this is not an all-clear. A refusal here usually means your role
            is below compliance.
          </p>
          <Button variant="outline" size="sm" onClick={() => audit.refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <AuditTable rows={audit.rows} />

          <p className="text-sm text-muted-foreground">
            Showing the newest {audit.rows.length} matching entries — the
            list holds at most {PAGE_LIMIT}. Narrow the filters to investigate
            further back.
          </p>
        </>
      )}
    </div>
  )
}

// The search boxes fire on every keystroke; the query must not. Same local
// debounce as the users list — a round-trip per character against the
// shared rate limit is never worth it.
function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = React.useState(value)

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
