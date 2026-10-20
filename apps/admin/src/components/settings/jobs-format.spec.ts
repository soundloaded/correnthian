import { describe, expect, it } from "vitest"

import { describeJobRun, formatInterval } from "./jobs-format"
import type { JobRun } from "./jobs-format"

const run = (patch: Partial<JobRun> = {}): JobRun => ({
  id: "run_1",
  jobName: "provider.health-probe",
  instanceId: "host:1",
  trigger: "manual",
  startedAt: "2026-10-20T04:34:04.000Z",
  finishedAt: "2026-10-20T04:34:04.065Z",
  durationMs: 65,
  outcome: "succeeded",
  affected: 12,
  detail: null,
  error: null,
  ...patch,
})

describe("describeJobRun", () => {
  it("reports a successful run with what it changed", () => {
    const result = describeJobRun(run())

    expect(result.ok).toBe(true)
    expect(result.text).toBe(
      "provider.health-probe ran — succeeded, 12 affected in 65ms.",
    )
  })

  it("does not report a failed job as a success, and carries its error", () => {
    const result = describeJobRun(
      run({ outcome: "failed", affected: 0, error: "lease could not be taken" }),
    )

    expect(result.ok).toBe(false)
    expect(result.text).toBe(
      "provider.health-probe ran — failed: lease could not be taken",
    )
  })
})

describe("formatInterval", () => {
  it("reads as minutes, hours and seconds", () => {
    expect(formatInterval(60_000)).toBe("1m")
    expect(formatInterval(24 * 60 * 60_000)).toBe("24h")
    expect(formatInterval(15_000)).toBe("15s")
  })
})
