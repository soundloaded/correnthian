import type { Contract } from "@correnthian/api-client"

export type JobRun = Contract<"POST /api/v1/jobs/:name/run">

/**
 * What an operator reads after pressing "Run now".
 *
 * A job that throws answers 200 with outcome `failed`, so the status code is
 * not a success — the run's own outcome is. Reporting a failed job as a
 * success is how an operator misses the thing they were looking for.
 */
export function describeJobRun(run: JobRun): { ok: boolean; text: string } {
  if (run.outcome === "succeeded") {
    return {
      ok: true,
      text: `${run.jobName} ran — succeeded, ${run.affected} affected in ${run.durationMs ?? 0}ms.`,
    }
  }
  return {
    ok: false,
    text: `${run.jobName} ran — ${run.outcome}${run.error ? `: ${run.error}` : "."}`,
  }
}

/** The cadence a job runs at, in the words an operator reads. */
export function formatInterval(ms: number): string {
  if (ms % 3_600_000 === 0) return `${ms / 3_600_000}h`
  if (ms % 60_000 === 0) return `${ms / 60_000}m`
  return `${Math.round(ms / 1000)}s`
}
