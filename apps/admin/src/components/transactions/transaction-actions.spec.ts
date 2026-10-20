import { describe, expect, it } from "vitest"

import {
  actionFor,
  observationNeedsReason,
  reasonRequired,
} from "./transaction-actions"

describe("transaction operator actions", () => {
  it("collects a hash for a broadcast and none for a signing report", () => {
    expect(actionFor("signed", "broadcast").needsTxHash).toBe(true)
    expect(actionFor("created", "signed").needsTxHash).toBe(false)
  })

  it("owes a reason only where the edge moves money backwards", () => {
    expect(reasonRequired("confirmed", "pending")).toBe(true)
    expect(reasonRequired("confirmed", "failed")).toBe(true)
    expect(reasonRequired("pending", "confirmed")).toBe(false)
  })

  it("marks a terminal edge destructive and a forward one not", () => {
    expect(actionFor("created", "failed").destructive).toBe(true)
    expect(actionFor("pending", "confirmed").destructive).toBe(false)
  })

  it("asks for a reason when a node reports a failure", () => {
    expect(observationNeedsReason("reverted")).toBe(true)
    expect(observationNeedsReason("replaced")).toBe(true)
    expect(observationNeedsReason("seen")).toBe(false)
  })
})
