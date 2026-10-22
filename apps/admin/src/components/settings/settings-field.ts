import type { Contract } from "@correnthian/api-client"

/** One setting, as the API serves it. Never hand-written: it follows the contract. */
export type SystemSetting = Contract<"GET /api/v1/settings/system">[number]

/** What the operator typed, and what the API should be told. */
export type ParsedSetting =
  | { ok: true; value: string | number | boolean }
  | { ok: false; error: string }

/**
 * The value as the input shows it.
 *
 * A number is rendered as digits and a string as itself, because the input
 * holds text either way. A boolean has no text form: it is a switch, and the
 * proposed value is the other side of it.
 */
export function settingInputValue(setting: SystemSetting): string {
  if (setting.type === "boolean") return setting.value ? "on" : "off"
  if (setting.value === null || setting.value === undefined) return ""
  return String(setting.value)
}

/**
 * The text form of a proposed value, for a field that holds text.
 *
 * A boolean is the trap here: `String(true)` is `"true"`, and the parser
 * reads `"on"` and `"off"`. A dialog that seeded its input with
 * `String(value)` would save `false` every time an operator turned a switch
 * on, and nothing would say so. The encoding lives in one place, and both
 * ends of it are pinned by a test.
 */
export function settingDraft(
  setting: SystemSetting,
  value: string | number | boolean,
): string {
  if (setting.type === "boolean") return value === true ? "on" : "off"
  return String(value)
}

/**
 * Turn what the operator typed into what the API should be told.
 *
 * The API validates the value against the setting's own schema, so this is
 * the console being helpful rather than the console being the authority: it
 * refuses the obvious mistakes before they cost a round trip, and it says
 * which bound was crossed, because "invalid" teaches nobody anything.
 */
export function parseSettingValue(
  setting: SystemSetting,
  raw: string,
): ParsedSetting {
  if (setting.type === "boolean") {
    return { ok: true, value: raw === "on" }
  }

  if (setting.type === "number") {
    const trimmed = raw.trim()
    if (trimmed === "") {
      return { ok: false, error: `${setting.label} needs a number.` }
    }
    const value = Number(trimmed)
    if (!Number.isInteger(value)) {
      return { ok: false, error: `${setting.label} must be a whole number.` }
    }
    if (setting.min !== undefined && value < setting.min) {
      return {
        ok: false,
        error: `${setting.label} cannot be below ${setting.min}.`,
      }
    }
    if (setting.max !== undefined && value > setting.max) {
      return {
        ok: false,
        error: `${setting.label} cannot be above ${setting.max}.`,
      }
    }
    return { ok: true, value }
  }

  if (setting.max !== undefined && raw.length > setting.max) {
    return {
      ok: false,
      error: `${setting.label} cannot be longer than ${setting.max} characters.`,
    }
  }
  return { ok: true, value: raw }
}

/** Where the value in force came from, in the words an operator reads. */
export function describeSource(setting: SystemSetting): string {
  return setting.source === "override" ? "overridden" : "default"
}

/** The reason the API asks for, and the floor it enforces. */
export const REASON_FLOOR = 8

export function reasonError(reason: string): string | null {
  if (reason.trim().length < REASON_FLOOR) {
    return `A reason of at least ${REASON_FLOOR} characters is required — it is recorded against your name.`
  }
  return null
}
