// Mirror of RedemptionService.transition's ALLOWED table — display only, so
// the console offers only edges the API will accept. The service re-checks
// every edge; a refusal there is the same rule, not a second opinion.
export const ALLOWED_NEXT: Record<string, string[]> = {
  requested: ["kyc_pending", "approved", "rejected", "cancelled"],
  kyc_pending: ["approved", "rejected", "cancelled"],
  approved: ["in_production", "cancelled"],
  in_production: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  rejected: [],
  cancelled: [],
}

// What the confirm dialog states for each edge: what moves, and what
// survives. Refusing or cancelling never burns or moves metal.
const EDGE_NOTES: Record<string, string> = {
  kyc_pending:
    "The request parks for identity review. Nothing moves; the metal stays where it is.",
  approved:
    "You are recorded as the reviewer. Approval authorises production — no metal moves and no shipment starts on this edge.",
  in_production:
    "Production begins against this request. The account's balance is untouched until shipment.",
  shipped:
    "The request is marked shipped. Confirm tracking with the provider — the console records the claim, not the parcel.",
  delivered:
    "The request closes as delivered. Terminal — it cannot move again.",
  rejected:
    "The request is refused. The account keeps its metal; refusing burns or moves nothing.",
  cancelled:
    "The request is cancelled. The account keeps its metal; cancelling moves nothing.",
}

export function edgeNote(next: string): string {
  return EDGE_NOTES[next] ?? "The state machine advances one edge."
}
