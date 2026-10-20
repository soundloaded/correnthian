/**
 * Form state → create-issuer body.
 *
 * Mirrors the API's `POST /api/v1/issuers` DTO. The server answers a bad
 * value with a generic 422 whose `detail` array the console client does not
 * surface, so the console names the offending field before sending.
 *
 * Two rules the server enforces and the form repeats: the slug is lowercase
 * alphanumerics and hyphens only, and a jurisdiction is a two-letter country
 * code. A new issuer is always created unverified — verification is a
 * separate, audited act, so the form does not offer a tier.
 */

export interface IssuerCreateForm {
  slug: string
  name: string
  jurisdiction: string
  licenseTypes: string
  licenseRefs: string
  website: string
  notes: string
}

export interface IssuerCreateBody {
  slug: string
  name: string
  jurisdiction: string
  licenseTypes: string[]
  licenseRefs: string[]
  website: string | null
  notes: string | null
}

export type BuildResult<T> =
  | { ok: true; body: T }
  | { ok: false; error: string }

const SLUG_PATTERN = /^[a-z0-9-]{2,64}$/

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

export function buildIssuerCreateBody(
  form: IssuerCreateForm,
): BuildResult<IssuerCreateBody> {
  const slug = form.slug.trim().toLowerCase()
  if (!slug) return { ok: false, error: "A slug is required." }
  if (!SLUG_PATTERN.test(slug))
    return {
      ok: false,
      error: "A slug is 2–64 characters of lowercase letters, digits and hyphens.",
    }

  const name = form.name.trim()
  if (!name) return { ok: false, error: "A name is required." }
  if (name.length > 160)
    return { ok: false, error: "A name is at most 160 characters." }

  const jurisdiction = form.jurisdiction.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(jurisdiction))
    return { ok: false, error: "A jurisdiction is a two-letter country code." }

  const licenseTypes = commaList(form.licenseTypes)
  if (licenseTypes.length > 20)
    return { ok: false, error: "At most 20 licence types." }
  if (licenseTypes.some((entry) => entry.length > 80))
    return { ok: false, error: "A licence type is at most 80 characters." }

  const licenseRefs = commaList(form.licenseRefs)
  if (licenseRefs.length > 40)
    return { ok: false, error: "At most 40 licence references." }
  if (licenseRefs.some((entry) => entry.length > 120))
    return { ok: false, error: "A licence reference is at most 120 characters." }

  const website = nullableText(form.website)
  if (website && website.length > 300)
    return { ok: false, error: "A website is at most 300 characters." }
  if (website && !isUrl(website))
    return { ok: false, error: "The website must be a full URL." }

  const notes = nullableText(form.notes)
  if (notes && notes.length > 2000)
    return { ok: false, error: "Notes are at most 2000 characters." }

  return {
    ok: true,
    body: {
      slug,
      name,
      jurisdiction,
      licenseTypes,
      licenseRefs,
      website,
      notes,
    },
  }
}
