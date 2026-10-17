import { Link, createFileRoute } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { ChevronLeftIcon } from "lucide-react"
import { AuditDetailCards } from "@/components/audit/audit-detail-cards"
import { useApiQuery } from "@/lib/use-api-query"

export const Route = createFileRoute("/_admin/audit/$auditId")({
  component: AuditDetailPage,
})

// One entry, with the before/after and metadata the list withholds —
// reading one payload is an investigation, not something to put in a table.
function AuditDetailPage() {
  const { auditId } = Route.useParams()
  const { data: entry, isLoading, isError, refetch } = useApiQuery(
    "GET /api/v1/audit/:id",
    { id: auditId },
  )

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <p className="text-sm text-muted-foreground">Loading audit entry…</p>
      </div>
    )
  }

  if (isError || !entry) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-8">
          <p className="text-sm font-medium">Could not load this audit entry</p>
          <p className="text-sm text-muted-foreground">
            {isError
              ? "The API did not answer, or this entry does not exist."
              : "This entry may have been removed or does not exist."}
          </p>
          {isError ? (
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          ) : (
            <Button variant="outline" size="sm" render={<Link to="/audit" />}>
              Back to audit
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" render={<Link to="/audit" />}>
          <ChevronLeftIcon className="size-4" />
          Audit
        </Button>
        <h1 className="font-mono text-lg font-semibold tracking-tight">{entry.action}</h1>
      </div>

      <AuditDetailCards entry={entry} />
    </div>
  )
}
