import type { Contract } from "@correnthian/api-client"

type TransactionDetail = Contract<"GET /api/v1/transactions/:id">

/** The lifecycle states, taken from the contract rather than restated here. */
export type TxState = TransactionDetail["state"]

/**
 * The edges that move a settled record backwards owe a reason.
 *
 * Mirrors the API's own set, so the console can say why before the
 * round-trip rather than after it.
 */
const REASON_REQUIRED = new Set(["confirmed>pending", "confirmed>failed"])

/** The API's floor: a reason shorter than this is a placeholder. */
export const MIN_REASON_LENGTH = 8

/** Terminal states — no edge leaves them. */
const TERMINAL: ReadonlySet<TxState> = new Set(["failed", "cancelled", "expired"])

export type ActionSpec = {
  /** Button label. */
  label: string
  /** What the edge means, in one line. */
  hint: string
  /** A broadcast is refused without the hash the row is bound to. */
  needsTxHash: boolean
  /** A failure carries the diagnosis that caused it. */
  needsError: boolean
  /** The edge owes a reason. */
  needsReason: boolean
  /** Terminal, or moving money backwards. */
  destructive: boolean
}

const ACTIONS: Record<TxState, Omit<ActionSpec, "needsReason" | "destructive">> = {
  created: {
    label: "Mark created",
    hint: "Never offered — a transaction is born in this state.",
    needsTxHash: false,
    needsError: false,
  },
  signed: {
    label: "Record signed",
    hint: "The account holder's device reported the signature. The API records the report; the console cannot verify it.",
    needsTxHash: false,
    needsError: false,
  },
  broadcast: {
    label: "Record broadcast",
    hint: "The transaction reached the network. The hash binds the row to it for life.",
    needsTxHash: true,
    needsError: false,
  },
  pending: {
    label: "Move to pending",
    hint: "On the network, not settled yet.",
    needsTxHash: false,
    needsError: false,
  },
  confirmed: {
    label: "Mark confirmed",
    hint: "The transaction reached its required confirmation depth.",
    needsTxHash: false,
    needsError: false,
  },
  failed: {
    label: "Mark failed",
    hint: "Record the failure. The code and message are kept on the row.",
    needsTxHash: false,
    needsError: true,
  },
  cancelled: {
    label: "Cancel",
    hint: "Retire the intent. Nothing exists on the network to undo.",
    needsTxHash: false,
    needsError: false,
  },
  expired: {
    label: "Mark expired",
    hint: "The intent passed its expiry.",
    needsTxHash: false,
    needsError: false,
  },
}

/** Does this edge owe a reason? */
export function reasonRequired(from: TxState, to: TxState): boolean {
  return REASON_REQUIRED.has(`${from}>${to}`)
}

/**
 * What the console must collect before it posts this edge.
 *
 * The API decides which edges exist — `permittedNext` says so — and this only
 * says what evidence the edge carries.
 */
export function actionFor(from: TxState, to: TxState): ActionSpec {
  const needsReason = reasonRequired(from, to)
  return {
    ...ACTIONS[to],
    needsReason,
    destructive: needsReason || TERMINAL.has(to),
  }
}

/** What a node reported. */
export const OBSERVATION_OUTCOMES = [
  "seen",
  "dropped",
  "reverted",
  "replaced",
] as const

export type ObservationOutcome = (typeof OBSERVATION_OUTCOMES)[number]

/**
 * A node reporting a failure is a chain fact, and a failure owes a reason —
 * moving a settled row to `failed` is the one edge the API demands a
 * justification for.
 */
export function observationNeedsReason(outcome: ObservationOutcome): boolean {
  return outcome === "reverted" || outcome === "replaced"
}
