/**
 * The create form's vocabulary, and the mapping from what an operator typed
 * to the fee-rule DTO.
 *
 * Kept out of the component so it can be checked without a browser: every
 * value here is a string somebody typed, and the rules that turn those
 * strings into a request body are the part worth a test.
 *
 * The DTO is the authority — this mirrors it so the operator is told which
 * field is wrong, instead of reading "Request validation failed".
 */

export const FEE_OPERATION_OPTIONS = [
  "swap",
  "buy",
  "sell",
  "redeem",
  "onramp",
  "offramp",
] as const

export const FEE_KIND_OPTIONS = ["network", "provider", "correnthian"] as const

export const FEE_BASIS_OPTIONS = ["percent", "fixed", "spread"] as const

export const FEE_ASSET_CATEGORY_OPTIONS = [
  "crypto",
  "stablecoin",
  "metal",
  "treasury",
  "fund",
  "other",
] as const

export type FeeRuleDraft = {
  operation: string
  kind: string
  basis: string
  label: string
  rateBps: string
  fixedUsd: string
  priority: string
  active: boolean
  assetId: string
  assetCategory: string
  providerSlug: string
  country: string
  region: string
  minNotionalUsd: string
  maxNotionalUsd: string
  effectiveFrom: string
  effectiveUntil: string
}

export const EMPTY_FEE_RULE_DRAFT: FeeRuleDraft = {
  operation: "swap",
  kind: "correnthian",
  basis: "percent",
  label: "",
  rateBps: "",
  fixedUsd: "",
  priority: "0",
  active: true,
  assetId: "",
  assetCategory: "",
  providerSlug: "",
  country: "",
  region: "",
  minNotionalUsd: "",
  maxNotionalUsd: "",
  effectiveFrom: "",
  effectiveUntil: "",
}

export type FeeRuleDraftResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; error: string }

/**
 * Turn the form into a create body, or say which field is wrong.
 *
 * A blank selector is omitted rather than sent as null: on a create both
 * mean "unrestricted", and omitting is what the DTO documents as the
 * default.
 */
export function buildFeeRuleBody(draft: FeeRuleDraft): FeeRuleDraftResult {
  const label = draft.label.trim()
  if (label === "") {
    return { ok: false, error: "A label is required — it is what the customer reads on the fee line." }
  }
  if (label.length > 80) {
    return { ok: false, error: "A label is at most 80 characters." }
  }
  if (!isOneOf(draft.operation, FEE_OPERATION_OPTIONS)) {
    return { ok: false, error: "Pick the operation the fee applies to." }
  }
  if (!isOneOf(draft.kind, FEE_KIND_OPTIONS)) {
    return { ok: false, error: "Pick who is paid by this fee." }
  }
  if (!isOneOf(draft.basis, FEE_BASIS_OPTIONS)) {
    return { ok: false, error: "Pick the basis — a percentage, a spread, or a fixed amount." }
  }

  const priority = parseIntStrict(draft.priority)
  if (priority === null || priority < -1000 || priority > 1000) {
    return { ok: false, error: "Priority is a whole number between -1000 and 1000." }
  }

  const body: Record<string, unknown> = {
    operation: draft.operation,
    kind: draft.kind,
    basis: draft.basis,
    label,
    priority,
    active: draft.active,
  }

  // A rule states either a rate or an amount, never both and never neither.
  if (draft.basis === "fixed") {
    const fixedUsd = draft.fixedUsd.trim()
    if (!isUsdAmount(fixedUsd)) {
      return { ok: false, error: "A fixed fee needs an amount, as an exact decimal like 1.50." }
    }
    body.fixedUsd = fixedUsd
    body.rateBps = null
  } else {
    const rateBps = parseIntStrict(draft.rateBps.trim())
    if (rateBps === null || rateBps < 0 || rateBps > 1_000_000) {
      return { ok: false, error: `A ${draft.basis} fee needs a rate in whole basis points, 0 to 1000000.` }
    }
    body.rateBps = rateBps
    body.fixedUsd = null
  }

  const assetId = draft.assetId.trim()
  if (assetId !== "") {
    if (assetId.length > 200) return { ok: false, error: "An asset id is at most 200 characters." }
    body.assetId = assetId
  }

  if (draft.assetCategory !== "") {
    if (!isOneOf(draft.assetCategory, FEE_ASSET_CATEGORY_OPTIONS)) {
      return { ok: false, error: "Pick an asset category, or leave it unrestricted." }
    }
    body.assetCategory = draft.assetCategory
  }

  const providerSlug = draft.providerSlug.trim()
  if (providerSlug !== "") {
    if (providerSlug.length > 80) return { ok: false, error: "A provider slug is at most 80 characters." }
    body.providerSlug = providerSlug
  }

  const country = draft.country.trim()
  if (country !== "") {
    if (country.length !== 2) return { ok: false, error: "A country is an ISO-3166 alpha-2 code, like US." }
    body.country = country.toUpperCase()
  }

  const region = draft.region.trim()
  if (region !== "") {
    if (region.length > 20) return { ok: false, error: "A region is at most 20 characters." }
    body.region = region
  }

  const min = draft.minNotionalUsd.trim()
  const max = draft.maxNotionalUsd.trim()
  if (min !== "" && !isUsdAmount(min)) {
    return { ok: false, error: "The lower notional bound is an exact decimal like 100.00." }
  }
  if (max !== "" && !isUsdAmount(max)) {
    return { ok: false, error: "The upper notional bound is an exact decimal like 10000.00." }
  }
  if (min !== "" && max !== "" && compareDecimals(min, max) > 0) {
    return { ok: false, error: "The lower bound is above the upper bound, so no notional could ever match." }
  }
  if (min !== "") body.minNotionalUsd = min
  if (max !== "") body.maxNotionalUsd = max

  const from = draft.effectiveFrom.trim()
  const until = draft.effectiveUntil.trim()
  const fromAt = from === "" ? null : parseInstant(from)
  const untilAt = until === "" ? null : parseInstant(until)
  if (from !== "" && fromAt === null) {
    return { ok: false, error: "The effective-from moment could not be read." }
  }
  if (until !== "" && untilAt === null) {
    return { ok: false, error: "The effective-until moment could not be read." }
  }
  if (fromAt !== null && untilAt !== null && fromAt.getTime() >= untilAt.getTime()) {
    return { ok: false, error: "The rule would end before it begins, so it would never apply." }
  }
  if (fromAt !== null) body.effectiveFrom = fromAt.toISOString()
  if (untilAt !== null) body.effectiveUntil = untilAt.toISOString()

  return { ok: true, body }
}

/**
 * What the confirm dialog says. Plain words, because the operator is about
 * to change what every quote costs and has to be able to picture it.
 */
export function describeFeeRule(draft: FeeRuleDraft): string {
  const charge =
    draft.basis === "fixed"
      ? `$${draft.fixedUsd.trim()} fixed`
      : `${(Number(draft.rateBps) / 100).toFixed(2)}% (${draft.rateBps.trim()} bps)${
          draft.basis === "spread" ? " spread" : ""
        }`

  const asset = draft.assetId.trim()
    ? `asset ${draft.assetId.trim()}`
    : draft.assetCategory
      ? `the ${draft.assetCategory} category`
      : "every asset"

  const provider = draft.providerSlug.trim()
    ? `provider ${draft.providerSlug.trim()}`
    : "every provider"

  const country = draft.country.trim().toUpperCase()
  const region = draft.region.trim()
  const jurisdiction =
    country !== "" && region !== ""
      ? `${country} / ${region}`
      : country !== ""
        ? `country ${country}`
        : region !== ""
          ? `region ${region}`
          : "every country"

  const min = draft.minNotionalUsd.trim()
  const max = draft.maxNotionalUsd.trim()
  const notional =
    min !== "" && max !== ""
      ? `a notional of $${min} to $${max}`
      : min !== ""
        ? `a notional of $${min} or more`
        : max !== ""
          ? `a notional of $${max} or less`
          : "any notional"

  const from = draft.effectiveFrom.trim()
  const until = draft.effectiveUntil.trim()
  const window =
    from !== "" && until !== ""
      ? `effective from ${from.replace("T", " ")} until ${until.replace("T", " ")}`
      : from !== ""
        ? `effective from ${from.replace("T", " ")}`
        : until !== ""
          ? `ending ${until.replace("T", " ")}`
          : "effective immediately"

  return (
    `A ${charge} ${draft.kind} fee on ${draft.operation}, labelled “${draft.label.trim()}”, ` +
    `applying to ${asset}, ${provider} and ${jurisdiction}, for ${notional}, ${window}. ` +
    `It will be ${draft.active ? "active" : "inactive"} at priority ${draft.priority.trim() || "0"}.`
  )
}

function isOneOf(value: string, options: readonly string[]): boolean {
  return options.includes(value)
}

/** A whole number, or null. Rejects "1.5", "1e3", "" and "12abc". */
function parseIntStrict(value: string): number | null {
  if (!/^-?\d+$/.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : null
}

/** An exact USD decimal, as a string. Never a float — see the money module. */
function isUsdAmount(value: string): boolean {
  return /^\d+(\.\d+)?$/.test(value)
}

/** A `datetime-local` value as an instant, or null if it cannot be read. */
function parseInstant(value: string): Date | null {
  const at = new Date(value)
  return Number.isNaN(at.getTime()) ? null : at
}

/**
 * Compare two plain decimal strings without converting either to a float.
 * Mirrors the DTO's comparison, so the console and the API agree on which
 * bound is the lower one.
 */
function compareDecimals(a: string, b: string): number {
  const [ai, af = ""] = a.split(".")
  const [bi, bf = ""] = b.split(".")
  const width = Math.max(af.length, bf.length)
  const left = BigInt((ai || "0") + af.padEnd(width, "0"))
  const right = BigInt((bi || "0") + bf.padEnd(width, "0"))
  return left === right ? 0 : left > right ? 1 : -1
}
