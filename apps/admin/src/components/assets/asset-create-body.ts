/**
 * Form state → create-asset body.
 *
 * The mapping lives apart from the dialog so it can be checked without a
 * browser. It mirrors the API's `POST /api/v1/assets` DTO field for field:
 * the server answers a bad value with a generic 422 and a `detail` array
 * the console client does not surface, so the console has to name the
 * offending field before the request is sent.
 */

export const ASSET_CATEGORY_OPTIONS = [
  "crypto",
  "stablecoin",
  "metal",
  "treasury",
  "fund",
  "other",
]

export const ASSET_TOKEN_STANDARD_OPTIONS = [
  "native",
  "erc20",
  "bep20",
  "btrc20",
  "spl",
  "other",
]

export const ASSET_CUSTODY_MODEL_OPTIONS = [
  "allocated",
  "unallocated",
  "synthetic",
]

export const ASSET_ATTESTATION_CADENCE_OPTIONS = [
  "monthly",
  "quarterly",
  "annual",
  "none",
]

export const ASSET_RAIL_OPTIONS = ["provider", "dex", "cex", "otc"]

export const ASSET_TIER_OPTIONS = [
  "issuer_verified",
  "community_verified",
  "unverified",
]

export interface AssetCreateForm {
  chainId: string
  contractAddress: string
  tokenStandard: string
  symbol: string
  name: string
  decimals: string
  category: string
  issuerId: string
  custodyModel: string
  custodian: string
  vaultLocations: string
  proofOfReserveUrl: string
  attestationCadence: string
  ouncesPerToken: string
  gramsPerToken: string
  rails: string[]
  swapSupported: boolean
  redeemSupported: boolean
  verifiedTier: string
  accentColor: string
  iconUrl: string
}

export interface AssetCreateBody {
  chainId: string
  contractAddress: string | null
  tokenStandard: string
  symbol: string
  name: string
  decimals: number
  category: string
  issuerId: string
  custodyModel: string
  custodian: string | null
  vaultLocations: string[]
  proofOfReserveUrl: string | null
  attestationCadence: string
  ouncesPerToken: number | null
  gramsPerToken: number | null
  rails: string[]
  swapSupported: boolean
  redeemSupported: boolean
  verifiedTier: string
  accentColor: string | null
  iconUrl: string | null
}

export type BuildResult<T> =
  | { ok: true; body: T }
  | { ok: false; error: string }

/** Empty text means "none", which the DTO spells as null. */
function nullableText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

function commaList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function isUrl(value: string): boolean {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

function optionalPositive(
  value: string,
  label: string,
): { ok: true; value: number | null } | { ok: false; error: string } {
  const trimmed = value.trim()
  if (trimmed === "") return { ok: true, value: null }
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1_000_000) {
    return {
      ok: false,
      error: `${label} must be a number between 0 and 1,000,000.`,
    }
  }
  return { ok: true, value: parsed }
}

export function buildAssetCreateBody(
  form: AssetCreateForm,
): BuildResult<AssetCreateBody> {
  const chainId = form.chainId.trim()
  if (!chainId) return { ok: false, error: "Choose the chain the token lives on." }
  if (chainId.length > 32)
    return { ok: false, error: "A chain id is at most 32 characters." }

  const symbol = form.symbol.trim()
  if (!symbol) return { ok: false, error: "A symbol is required." }
  if (symbol.length > 16)
    return { ok: false, error: "A symbol is at most 16 characters." }

  const name = form.name.trim()
  if (!name) return { ok: false, error: "A name is required." }
  if (name.length > 120)
    return { ok: false, error: "A name is at most 120 characters." }

  const decimals = Number(form.decimals.trim())
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    return {
      ok: false,
      error: "Decimals must be a whole number between 0 and 36.",
    }
  }

  if (!ASSET_CATEGORY_OPTIONS.includes(form.category))
    return { ok: false, error: "Choose a category." }
  if (!ASSET_TOKEN_STANDARD_OPTIONS.includes(form.tokenStandard))
    return { ok: false, error: "Choose a token standard." }
  if (!ASSET_CUSTODY_MODEL_OPTIONS.includes(form.custodyModel))
    return { ok: false, error: "Choose a custody model." }
  if (!ASSET_ATTESTATION_CADENCE_OPTIONS.includes(form.attestationCadence))
    return { ok: false, error: "Choose an attestation cadence." }
  if (!ASSET_TIER_OPTIONS.includes(form.verifiedTier))
    return { ok: false, error: "Choose a verification tier." }

  const issuerId = form.issuerId.trim()
  if (!issuerId)
    return {
      ok: false,
      error: "Choose the issuer that stands behind this token.",
    }
  if (issuerId.length > 64)
    return { ok: false, error: "An issuer slug is at most 64 characters." }

  const contractAddress = nullableText(form.contractAddress)
  if (contractAddress && contractAddress.length > 128)
    return { ok: false, error: "A contract address is at most 128 characters." }

  const custodian = nullableText(form.custodian)
  if (custodian && custodian.length > 160)
    return { ok: false, error: "A custodian name is at most 160 characters." }

  const vaultLocations = commaList(form.vaultLocations)
  if (vaultLocations.length > 20)
    return { ok: false, error: "At most 20 vault locations." }
  if (vaultLocations.some((entry) => entry.length > 120))
    return { ok: false, error: "A vault location is at most 120 characters." }

  const proofOfReserveUrl = nullableText(form.proofOfReserveUrl)
  if (proofOfReserveUrl && !isUrl(proofOfReserveUrl))
    return {
      ok: false,
      error: "The proof-of-reserves link must be a full URL.",
    }

  const iconUrl = nullableText(form.iconUrl)
  if (iconUrl && !isUrl(iconUrl))
    return { ok: false, error: "The icon link must be a full URL." }

  const accentColor = nullableText(form.accentColor)
  if (accentColor && accentColor.length > 32)
    return { ok: false, error: "An accent colour is at most 32 characters." }

  const ounces = optionalPositive(form.ouncesPerToken, "Ounces per token")
  if (!ounces.ok) return { ok: false, error: ounces.error }
  const grams = optionalPositive(form.gramsPerToken, "Grams per token")
  if (!grams.ok) return { ok: false, error: grams.error }

  const rails = form.rails.filter((rail) => ASSET_RAIL_OPTIONS.includes(rail))

  return {
    ok: true,
    body: {
      chainId,
      contractAddress,
      tokenStandard: form.tokenStandard,
      symbol,
      name,
      decimals,
      category: form.category,
      issuerId,
      custodyModel: form.custodyModel,
      custodian,
      vaultLocations,
      proofOfReserveUrl,
      attestationCadence: form.attestationCadence,
      ouncesPerToken: ounces.value,
      gramsPerToken: grams.value,
      rails,
      swapSupported: form.swapSupported,
      redeemSupported: form.redeemSupported,
      verifiedTier: form.verifiedTier,
      accentColor,
      iconUrl,
    },
  }
}
