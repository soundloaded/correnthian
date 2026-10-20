import { describe, expect, it } from "vitest"

import {
  EMPTY_FEE_RULE_DRAFT,
  buildFeeRuleBody,
  describeFeeRule,
  type FeeRuleDraft,
} from "./fee-rule-input"

/**
 * The create form's mapping onto the fee-rule DTO.
 *
 * The DTO is the real authority; this checks the console's mirror of it, so
 * an operator is told which field is wrong instead of reading "Request
 * validation failed", and so a rule cannot be created with a rate and an
 * amount at once.
 */

const draft = (patch: Partial<FeeRuleDraft> = {}): FeeRuleDraft => ({
  ...EMPTY_FEE_RULE_DRAFT,
  label: "Gold buy fee",
  rateBps: "25",
  ...patch,
})

describe("buildFeeRuleBody", () => {
  it("maps a percentage rule, and states the amount as absent", () => {
    const result = buildFeeRuleBody(draft())

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.body).toMatchObject({
      operation: "swap",
      kind: "correnthian",
      basis: "percent",
      label: "Gold buy fee",
      rateBps: 25,
      fixedUsd: null,
      priority: 0,
      active: true,
    })
  })

  it("maps a fixed rule, and states the rate as absent", () => {
    const result = buildFeeRuleBody(draft({ basis: "fixed", fixedUsd: "1.50", rateBps: "25" }))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.body.fixedUsd).toBe("1.50")
    expect(result.body.rateBps).toBeNull()
  })

  it("refuses a percentage rule with no rate", () => {
    const result = buildFeeRuleBody(draft({ rateBps: "" }))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain("basis points")
  })

  it("refuses a fixed rule with no amount", () => {
    const result = buildFeeRuleBody(draft({ basis: "fixed", fixedUsd: "" }))

    expect(result.ok).toBe(false)
  })

  it("refuses a rule with no label", () => {
    const result = buildFeeRuleBody(draft({ label: "   " }))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain("label")
  })

  it("omits a blank selector, which on a create means unrestricted", () => {
    const result = buildFeeRuleBody(draft())

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect("assetId" in result.body).toBe(false)
    expect("country" in result.body).toBe(false)
  })

  it("keeps the selectors an operator did state", () => {
    const result = buildFeeRuleBody(draft({ country: "us", assetCategory: "metal" }))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.body.country).toBe("US")
    expect(result.body.assetCategory).toBe("metal")
  })

  it("refuses a notional window that closes on itself", () => {
    const result = buildFeeRuleBody(draft({ minNotionalUsd: "1000", maxNotionalUsd: "100" }))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain("lower bound")
  })

  it("compares bounds exactly, so 100.10 is not below 100.1", () => {
    const result = buildFeeRuleBody(draft({ minNotionalUsd: "100.10", maxNotionalUsd: "100.1" }))

    expect(result.ok).toBe(true)
  })

  it("refuses a window that ends before it begins", () => {
    const result = buildFeeRuleBody(
      draft({ effectiveFrom: "2026-10-20T12:00", effectiveUntil: "2026-10-20T10:00" }),
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain("before it begins")
  })

  it("refuses a country that is not an alpha-2 code", () => {
    const result = buildFeeRuleBody(draft({ country: "USA" }))

    expect(result.ok).toBe(false)
  })
})

describe("describeFeeRule", () => {
  it("says what will be created, in plain words", () => {
    const text = describeFeeRule(draft({ label: "Gold buy fee", rateBps: "25" }))

    expect(text).toContain("0.25% (25 bps)")
    expect(text).toContain("correnthian")
    expect(text).toContain("swap")
    expect(text).toContain("Gold buy fee")
    expect(text).toContain("every asset")
  })
})
