"use client"

import * as React from "react"

import { PlayIcon } from "lucide-react"

import { api } from "@/lib/api"
import { getSession } from "@/lib/auth"
import { rankAtLeast } from "@/lib/roles"
import { useApiQuery } from "@/lib/use-api-query"
import type { ApiResult, Contract } from "@correnthian/api-client"
import { Badge } from "@correnthian/ui/components/badge"
import { Button } from "@correnthian/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@correnthian/ui/components/table"
import { cn } from "@correnthian/ui/lib/utils"

import { describeJobRun, formatInterval } from "./jobs-format"

type JobRow = Contract<"GET /api/v1/jobs">["jobs"][number]

// The schedule, as the operator sees it. Reading the list needs the support
// role; running a job needs admin, so the buttons are hidden below it —
// the gate is display-only, RolesGuard decides. Errors render inline, never
// as a toast.
export function JobsSettings() {
  const role = getSession()?.role ?? "user"
  const canRun = rankAtLeast(role, "admin")
  const jobs = useApiQuery("GET /api/v1/jobs")

  const [running, setRunning] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<{
    ok: boolean
    text: string
  } | null>(null)

  const runNow = async (name: string) => {
    setRunning(name)
    setNotice(null)
    const result = await api.request("POST /api/v1/jobs/:name/run", {
      method: "POST",
      params: { name },
    })
    setRunning(null)
    if (result.status === "ok") {
      setNotice(describeJobRun(result.data))
      void jobs.refetch()
    } else {
      setNotice({ ok: false, text: toMessage(result) })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Scheduled jobs</h2>
        <p className="text-sm text-muted-foreground">
          The jobs Correnthian runs on a timer, and what the last run of each
          one did. A job that has not started within three intervals reads as
          overdue — that is the "it silently stopped" signal.
        </p>
      </div>

      {!canRun && (
        <p className="text-sm text-muted-foreground">
          Running a job needs the admin role. Your session is {role}, so the
          buttons are hidden for you.
        </p>
      )}

      {notice && (
        <p
          role="alert"
          className={cn(
            "text-sm",
            notice.ok ? "text-muted-foreground" : "text-destructive",
          )}
        >
          {notice.text}
        </p>
      )}

      {jobs.isPending ? (
        <p className="text-sm text-muted-foreground">Loading jobs…</p>
      ) : jobs.isError ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-8">
          <p className="text-sm font-medium">Could not load the schedule</p>
          <p className="text-sm text-muted-foreground">
            The API did not answer. The table below may be stale or empty —
            this is not an all-clear.
          </p>
          <Button variant="outline" size="sm" onClick={() => jobs.refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <SchedulerSummary scheduler={jobs.data.scheduler} />

          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="pl-4">Job</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead>Cadence</TableHead>
                  <TableHead>Last run</TableHead>
                  <TableHead className="pr-4">Run now</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {jobs.data.jobs.map((job) => (
                  <JobTableRow
                    key={job.name}
                    job={job}
                    canRun={canRun}
                    running={running === job.name}
                    disabled={running !== null}
                    onRun={() => runNow(job.name)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}

function SchedulerSummary({
  scheduler,
}: {
  scheduler: Contract<"GET /api/v1/jobs">["scheduler"]
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span>
        Scheduler{" "}
        <span className={scheduler.running ? "text-foreground" : "text-destructive"}>
          {scheduler.running ? "running" : "stopped"}
        </span>
      </span>
      <span>instance {scheduler.instanceId}</span>
      <span>tick {Math.round(scheduler.tickMs / 1000)}s</span>
      <span>
        last tick{" "}
        {scheduler.lastTickAt ? formatDateTime(scheduler.lastTickAt) : "never"}
      </span>
      {scheduler.lastLeaseError && (
        <span className="text-destructive">{scheduler.lastLeaseError}</span>
      )}
    </div>
  )
}

function JobTableRow({
  job,
  canRun,
  running,
  disabled,
  onRun,
}: {
  job: JobRow
  canRun: boolean
  running: boolean
  disabled: boolean
  onRun: () => void
}) {
  return (
    <TableRow>
      <TableCell className="pl-4">
        <p className="font-mono text-sm font-medium">{job.name}</p>
        <p className="mt-0.5 max-w-xs whitespace-normal text-xs text-muted-foreground">
          {job.description}
        </p>
      </TableCell>

      <TableCell>
        <JobHealthBadge health={job.health} />
      </TableCell>

      <TableCell className="whitespace-nowrap tabular-nums">
        every {formatInterval(job.everyMs)}
      </TableCell>

      <TableCell className="whitespace-nowrap text-muted-foreground">
        {job.lastRun ? (
          <span>
            {formatDateTime(job.lastRun.startedAt)} ·{" "}
            <span
              className={cn(
                job.lastRun.outcome === "failed" && "text-destructive",
              )}
            >
              {job.lastRun.outcome}
            </span>
          </span>
        ) : (
          "never"
        )}
      </TableCell>

      <TableCell className="pr-4">
        {canRun && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={onRun}
            disabled={disabled}
          >
            <PlayIcon className="size-4" />
            {running ? "Running…" : "Run now"}
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}

// `overdue` and `never_run` take the amber tone rather than grey: the job is
// not doing what the schedule says it does, which is what an operator has to
// act on. Unknown values fall back to neutral — the API owns this vocabulary.
const healthStyles: Record<string, string> = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400",
  running:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400",
  failing:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400",
  overdue:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400",
  never_run:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400",
  disabled:
    "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400",
}

function JobHealthBadge({ health }: { health: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md px-2 py-0.5 text-xs font-medium",
        healthStyles[health],
      )}
    >
      {health.replaceAll("_", " ")}
    </Badge>
  )
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function toMessage(
  result: Exclude<ApiResult<unknown>, { status: "ok" }>,
): string {
  if (result.status === "unauthorised") return "Your session expired. Sign in again."
  return result.message
}
