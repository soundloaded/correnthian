import { describe, expect, it } from "vitest"

import { buildIssuerCreateBody } from "./issuer-create-body"
import type { IssuerCreateForm } from "./issuer-create-body"

const VALID: IssuerCreateForm = {
  slug: "acme-metals",
  name: "Acme Metals Ltd",
  jurisdiction: "GB",
  licenseTypes: "FCA licence, LBMA member",
  licenseRefs: "FCA-12345",
  website: "https://example.com",
  notes: "Registered in the UK.",
}

describe("buildIssuerCreateBody", () => {
  it("maps the form onto the create DTO", () => {
    const result = buildIssuerCreateBody(VALID)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.body).toEqual({
      slug: "acme-metals",
      name: "Acme Metals Ltd",
      jurisdiction: "GB",
      licenseTypes: ["FCA licence", "LBMA member"],
      licenseRefs: ["FCA-12345"],
      website: "https://example.com",
      notes: "Registered in the UK.",
    })
  })

  it("lowers the slug and upper-cases the jurisdiction, as the server does", () => {
    const result = buildIssuerCreateBody({
      ...VALID,
      slug: " Acme-Metals ",
      jurisdiction: "gb",
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.body.slug).toBe("acme-metals")
    expect(result.body.jurisdiction).toBe("GB")
  })

  it("spells empty optional fields as null", () => {
    const result = buildIssuerCreateBody({
      ...VALID,
      website: "",
      notes: "  ",
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.body.website).toBeNull()
    expect(result.body.notes).toBeNull()
  })

  it("refuses what the server refuses", () => {
    expect(buildIssuerCreateBody({ ...VALID, slug: "Acme Metals" }).ok).toBe(
      false,
    )
    expect(buildIssuerCreateBody({ ...VALID, slug: "a" }).ok).toBe(false)
    expect(buildIssuerCreateBody({ ...VALID, name: "" }).ok).toBe(false)
    expect(buildIssuerCreateBody({ ...VALID, jurisdiction: "GBR" }).ok).toBe(
      false,
    )
    expect(buildIssuerCreateBody({ ...VALID, website: "example.com" }).ok).toBe(
      false,
    )
  })
})
