import { describe, expect, it } from "vitest"

import { buildAssetCreateBody } from "./asset-create-body"
import type { AssetCreateForm } from "./asset-create-body"

const VALID: AssetCreateForm = {
  chainId: "1",
  contractAddress: "0xabc",
  tokenStandard: "erc20",
  symbol: "XAU",
  name: "Tokenised gold",
  decimals: "18",
  category: "metal",
  issuerId: "acme-metals",
  custodyModel: "allocated",
  custodian: "Acme Vaults",
  vaultLocations: "London, Zurich",
  proofOfReserveUrl: "https://example.com/por.pdf",
  attestationCadence: "monthly",
  ouncesPerToken: "1",
  gramsPerToken: "31.1",
  rails: ["provider"],
  swapSupported: true,
  redeemSupported: false,
  verifiedTier: "unverified",
  accentColor: "#c9a227",
  iconUrl: "https://example.com/icon.png",
}

describe("buildAssetCreateBody", () => {
  it("maps the form onto the create DTO", () => {
    const result = buildAssetCreateBody(VALID)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.body).toMatchObject({
      chainId: "1",
      symbol: "XAU",
      name: "Tokenised gold",
      decimals: 18,
      category: "metal",
      issuerId: "acme-metals",
      custodyModel: "allocated",
      vaultLocations: ["London", "Zurich"],
      ouncesPerToken: 1,
      gramsPerToken: 31.1,
      rails: ["provider"],
      swapSupported: true,
      redeemSupported: false,
    })
  })

  it("spells empty optional fields as null, not empty strings", () => {
    const result = buildAssetCreateBody({
      ...VALID,
      contractAddress: "  ",
      custodian: "",
      proofOfReserveUrl: "",
      ouncesPerToken: "",
      gramsPerToken: "",
      accentColor: "",
      iconUrl: "",
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.body.contractAddress).toBeNull()
    expect(result.body.custodian).toBeNull()
    expect(result.body.proofOfReserveUrl).toBeNull()
    expect(result.body.ouncesPerToken).toBeNull()
    expect(result.body.gramsPerToken).toBeNull()
    expect(result.body.accentColor).toBeNull()
    expect(result.body.iconUrl).toBeNull()
  })

  it("names the field the server would refuse", () => {
    expect(buildAssetCreateBody({ ...VALID, symbol: "" }).ok).toBe(false)
    expect(buildAssetCreateBody({ ...VALID, chainId: "" }).ok).toBe(false)
    expect(buildAssetCreateBody({ ...VALID, issuerId: "" }).ok).toBe(false)
    expect(buildAssetCreateBody({ ...VALID, decimals: "eighteen" }).ok).toBe(
      false,
    )
    expect(buildAssetCreateBody({ ...VALID, decimals: "37" }).ok).toBe(false)
    expect(
      buildAssetCreateBody({ ...VALID, proofOfReserveUrl: "example.com" }).ok,
    ).toBe(false)
    expect(
      buildAssetCreateBody({ ...VALID, ouncesPerToken: "-1" }).ok,
    ).toBe(false)
  })
})
