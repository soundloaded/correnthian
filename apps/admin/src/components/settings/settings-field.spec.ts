import { describe, expect, it } from "vitest"

import {
  describeSource,
  parseSettingValue,
  reasonError,
  settingDraft,
  settingInputValue,
  type SystemSetting,
} from "./settings-field"

/**
 * The console's side of a setting: what the operator typed, and what the API
 * is told. The API validates the value against the setting's own schema, so
 * this is the console being helpful — the tests pin the messages, because a
 * message that says only "invalid" teaches nobody anything.
 */

const setting = (over: Partial<SystemSetting> = {}): SystemSetting => ({
  key: "transactions.intent-ttl-minutes",
  value: 15,
  source: "default",
  category: "Transactions",
  label: "Intent lifetime",
  description: "How long an intent stays actionable.",
  type: "number",
  min: 1,
  max: 1440,
  clientVisible: false,
  updatedAt: null,
  ...over,
})

describe("parseSettingValue", () => {
  it("reads a whole number inside the bounds", () => {
    expect(parseSettingValue(setting(), "30")).toEqual({ ok: true, value: 30 })
  })

  it("refuses a number that is not whole", () => {
    const result = parseSettingValue(setting(), "1.5")
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error).toMatch(/whole number/)
  })

  it("refuses a number outside the bounds, and says which bound", () => {
    const low = parseSettingValue(setting(), "0")
    expect(low.ok === false && low.error).toMatch(/below 1/)

    const high = parseSettingValue(setting(), "5000")
    expect(high.ok === false && high.error).toMatch(/above 1440/)
  })

  it("refuses an empty number rather than sending a blank", () => {
    const result = parseSettingValue(setting(), "   ")
    expect(result.ok === false && result.error).toMatch(/needs a number/)
  })

  it("reads a string, and refuses one that is too long", () => {
    const text = setting({ type: "string", value: "hello", max: 280 })
    expect(parseSettingValue(text, "Back at 14:00.")).toEqual({
      ok: true,
      value: "Back at 14:00.",
    })

    const long = parseSettingValue(text, "x".repeat(281))
    expect(long.ok === false && long.error).toMatch(/longer than 280/)
  })

  it("reads a boolean from the side of the switch it is on", () => {
    const flag = setting({ type: "boolean", value: false, min: undefined, max: undefined })
    expect(parseSettingValue(flag, "on")).toEqual({ ok: true, value: true })
    expect(parseSettingValue(flag, "off")).toEqual({ ok: true, value: false })
  })
})

describe("settingDraft", () => {
  it("round-trips a boolean through the text form the parser reads", () => {
    // The bug this pins: a dialog seeded with `String(true)` — "true" — and
    // a parser that reads "on" and "off" save `false` every time an operator
    // turns a switch on, silently.
    const flag = setting({ type: "boolean", value: false, min: undefined, max: undefined })
    for (const proposed of [true, false]) {
      const draft = settingDraft(flag, proposed)
      expect(parseSettingValue(flag, draft)).toEqual({ ok: true, value: proposed })
    }
  })

  it("round-trips a number and a string", () => {
    expect(settingDraft(setting(), 45)).toBe("45")
    expect(settingDraft(setting({ type: "string", value: "hi" }), "hi")).toBe("hi")
  })
})

describe("settingInputValue", () => {
  it("shows a number as digits and a string as itself", () => {
    expect(settingInputValue(setting())).toBe("15")
    expect(
      settingInputValue(
        setting({ type: "string", value: "Back at 14:00.", min: undefined }),
      ),
    ).toBe("Back at 14:00.")
  })

  it("shows a boolean as the side it is on", () => {
    expect(
      settingInputValue(setting({ type: "boolean", value: true, min: undefined })),
    ).toBe("on")
  })
})

describe("describeSource", () => {
  it("says whether the value in force is the default or an override", () => {
    expect(describeSource(setting())).toBe("default")
    expect(describeSource(setting({ source: "override" }))).toBe("overridden")
  })
})

describe("reasonError", () => {
  it("asks for the floor the API enforces", () => {
    expect(reasonError("short")).toMatch(/at least 8 characters/)
    expect(reasonError("long enough to pass")).toBeNull()
  })
})
