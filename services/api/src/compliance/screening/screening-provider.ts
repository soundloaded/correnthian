/**
 * The screening port — BE-1101/BE-1105.
 *
 * Identity verification and watchlist screening sit behind this interface so
 * the state machine, the fiat gate and the review queue never learn which
 * vendor answered. The user chose Persona; the architecture must survive
 * that choice changing, because "no provider is contracted" was true when
 * this was written and an adapter against an imagined API gets rewritten
 * against a real contract.
 *
 * Two rules every implementation keeps:
 *
 *  - Decisions are codes, never PII. A verdict carries pass/decline codes
 *    and a watchlist outcome. Names, documents, images and raw vendor
 *    payloads never cross this interface, so they can never reach a log,
 *    an audit row or a response through it.
 *  - Absence of an answer is an error, never a default. An implementation
 *    that cannot reach its vendor throws `ScreeningUnavailableError`; it
 *    does not return "clean", because the fiat gate treats "clean" as
 *    permission and a timeout must never be permission.
 */

/** What the vendor decided about the verification itself. */
export type ScreeningVerdict = 'passed' | 'declined' | 'needs_review';

/** What the vendor's list matching says. Binary on purpose: fuzzy list
 *  matching that returned a score would invite a threshold, and a threshold
 *  is a machine clearing a flagged person — which §3 forbids. */
export type WatchlistResult = 'clean' | 'hit';

export interface InquiryDecision {
  verdict: ScreeningVerdict;
  watchlist: WatchlistResult;
  /** Vendor decision codes only. Never PII. */
  codes: string[];
  occurredAt: Date;
}

export interface ParsedWebhookEvent {
  eventId: string;
  inquiryId: string;
  /** Our user id, as sent in the inquiry reference. Null when the event
   *  carries no reference — which makes it unbindable, not ignorable. */
  referenceId: string | null;
  occurredAt: Date;
  /** Null for non-decision events (created, expired): seen, not applied. */
  decision: InquiryDecision | null;
}

export interface CreatedInquiry {
  inquiryId: string;
  /** Handed to the client for the vendor's SDK/hosted flow. Short-lived
   *  by vendor design; never persisted — a stored session token is a
   *  bearer credential in our database. */
  sessionToken: string;
}

export interface Screening {
  result: WatchlistResult;
  screenedAt: Date;
}

/** The vendor could not be reached or refused. The gate treats this as
 *  "unknown", which denies — it is never mapped to a verdict. */
export class ScreeningUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScreeningUnavailableError';
  }
}

export abstract class ScreeningProvider {
  abstract readonly name: string;
  /** Open an inquiry for the user. Idempotent per user: a second call
   *  while one is live returns the live one rather than spawning another. */
  abstract createInquiry(userId: string): Promise<CreatedInquiry>;
  /** A fresh list check for the user, outside any inquiry flow. */
  abstract rescreen(userId: string): Promise<Screening>;
  /** Constant-time check of the vendor's signature over the raw body. */
  abstract verifyWebhookSignature(rawBody: Buffer, signature: string): boolean;
  /** Strict parse: unknown shapes throw rather than guess. */
  abstract parseWebhookEvent(body: unknown): ParsedWebhookEvent;
}
