/**
 * The transaction lifecycle — §21 and §62.
 *
 * This file is the only place that knows which transitions exist. The service
 * reads it; nothing re-derives it with an `if (state === ...)` chain.
 *
 * ## Why an allowlist rather than a chain of conditions
 *
 * The tempting shape is:
 *
 *     if (from === 'created' && to === 'signed') ...
 *     else if (from === 'created' && to === 'broadcast') ...   // usually harmless
 *     else if (from === 'created' && to === 'confirmed') ...   // someone is wrong
 *
 * Every one of those branches looks locally reasonable, and the review that
 * misses one is invisible — the code still works, it just permits something a
 * second operator would have rejected. With a table the *absence* of an edge is
 * the default, and adding one is a deliberate, reviewable act. `RedemptionService.transition`
 * already does it this way; this is the same discipline for money movement.
 *
 * The reason each edge is present or absent is written on it. A state machine
 * whose edges are unexplained gets "fixed" by someone adding the missing one.
 */

/** Mirrors the Prisma `TxLifecycle` enum. */
export const TX_STATES = [
  'created',
  'signed',
  'broadcast',
  'pending',
  'confirmed',
  'failed',
  'cancelled',
  'expired',
] as const;

export type TxState = (typeof TX_STATES)[number];

export type TransitionTable = Readonly<Record<TxState, readonly TxState[]>>;

/**
 * Outbound and internal movement.
 *
 * `created → signed → broadcast → pending → confirmed`, with `failed`,
 * `cancelled` and `expired` as exits.
 */
const OUTBOUND: TransitionTable = {
  created: [
    // Nobody has signed yet. Only the owner can retire an unsigned intent.
    'signed', 'failed', 'cancelled', 'expired',
    // `broadcast` is NOT here. A transaction on the network with no signature
    // against it means somebody else signed it, and if that is not a bug it
    // is a takeover. Refusing the edge is what makes that visible.
  ],
  signed: [
    'broadcast',
    // The signature has been made but nothing is on the network, so it can
    // still be abandoned. From `broadcast` it cannot — see below.
    'failed', 'cancelled', 'expired',
  ],
  broadcast: [
    'pending',
    // The one deliberate skip in the §21 diagram. A node can see a
    // transaction mined in the very block it was broadcast in, and forcing an
    // operator to write a fictional `pending` first would be worse than
    // honest: it would put a state in the trail that no one observed.
    'confirmed',
    // Not `cancelled` and not `expired`. The transaction exists on the
    // network and may or may not be mined; cancelling it would be a claim
    // about someone else's money that we cannot make. It fails or it confirms.
    'failed',
  ],
  pending: [
    'confirmed',
    // A reorg, or a node that read below the required depth. Un-financing
    // something an operator already called settled is not something an
    // out-of-order write should be able to do quietly.
    'failed',
    // Dropped from the mempool and re-broadcast. This edge is the answer to
    // "what happens when a transaction is dropped and reappears": the row
    // never left the lifecycle, it kept the same identity, and the drop is
    // recorded as `droppedAt`/`dropCount` rather than as a state of its own.
    'broadcast',
  ],
  confirmed: [
    'pending', 'failed',
    // Both are reorgs, and both are the reason a *reason* is mandatory below.
    // Un-confirming a settled financial record without saying why is exactly
    // the entry an investigator would find and could not act on.
  ],
  // Terminal. A failed transaction cannot be revived: whatever made it fail
  // has not been undone, and re-running it would be a new transaction with a
  // new nonce.
  failed: [],
  cancelled: [],
  expired: [],
};

/**
 * Inbound movement — value arriving at a registered address.
 *
 * No one signs an inbound transfer, so the signing states do not exist on this
 * path. Pretending otherwise would mean either fabricating a `signed` hop or
 * allowing `created → pending` to mean "skipped a control", which is the
 * opposite of what this table is for. The hash is attached at `pending`, where
 * the chain is what tells us it exists.
 */
const INBOUND: TransitionTable = {
  created: ['pending', 'failed'],
  // Unreachable on this path; kept total so the lookup cannot return undefined.
  signed: [],
  broadcast: [],
  pending: ['confirmed', 'failed'],
  confirmed: ['pending', 'failed'],
  failed: [],
  cancelled: [],
  expired: [],
};

const TABLES: Record<'out' | 'in' | 'internal', TransitionTable> = {
  out: OUTBOUND,
  in: INBOUND,
  // An internal movement (a rebalance, a provider settlement) is signed by a
  // device like any other outbound movement; only its provenance differs.
  internal: OUTBOUND,
};

export function allowedTransitions(direction: 'in' | 'out' | 'internal', from: TxState): readonly TxState[] {
  return TABLES[direction][from] ?? [];
}

export function isTerminal(state: TxState): boolean {
  return allowedTransitions('out', state).length === 0 && allowedTransitions('in', state).length === 0;
}

/** States where nothing exists on the network yet, so nothing has to be undone. */
export function isPreBroadcast(state: TxState): boolean {
  return state === 'created' || state === 'signed';
}

/**
 * Who is allowed to assert each state.
 *
 * This is a second allowlist rather than a branch inside the first, because
 * "is this transition legal" and "is this caller entitled to make it" fail for
 * different reasons and need to be read separately.
 *
 *  - `owner`     — the wallet's own account, or anyone at or above `support`.
 *  - `operator`  — `support` and above only. Chain facts and diagnoses.
 *  - `system`    — the scheduler. Nobody may assert it by hand.
 *
 * `pending` and `confirmed` are operator-only because they are claims about
 * what the chain says, and the account holder is not in a position to know.
 * `failed` is operator-only for the same reason: "my transaction failed" is a
 * self-assessment, and a failure diagnosis is what an operator is for.
 */
export type Reporter = 'owner' | 'operator' | 'system';

const REPORTERS: Readonly<Record<TxState, Reporter>> = {
  // Reachable only by `TransactionService.create`.
  created: 'system',
  // The device reporting that it signed. Correnthian did not and cannot.
  signed: 'owner',
  // The device reporting that it put the transaction on the network.
  broadcast: 'owner',
  pending: 'operator',
  confirmed: 'operator',
  failed: 'operator',
  cancelled: 'owner',
  // Also the expiry sweep, which runs as `system`.
  expired: 'owner',
};

export function reporterFor(state: TxState): Reporter {
  return REPORTERS[state];
}

/** A role that is not a user role: the scheduler's identity. */
export const SYSTEM_ROLE = 'system';

/**
 * Transitions that need a stated reason, keyed `"from>to"`.
 *
 * Only transitions that move money *backwards*. A forward transition is the
 * system doing what it is supposed to do and needs no justification; an
 * un-confirmation is a statement about a record other people may have relied
 * on, so it has to say why.
 */
export const REASON_REQUIRED: ReadonlySet<string> = new Set([
  'confirmed>pending',
  'confirmed>failed',
]);

export function reasonRequired(from: TxState, to: TxState): boolean {
  return REASON_REQUIRED.has(`${from}>${to}`);
}

/**
 * Confirmation depth at which a transaction is treated as final, by chain
 * family.
 *
 * Conservative defaults, and they are defaults rather than policy: the real
 * numbers belong to the chain adapter's finality rule, which lands with
 * §14/§15. Until then, a caller may raise `requiredConfirmations` on create for
 * a large value, and the number is stored per row rather than computed at read
 * time so that changing this map cannot retroactively move a settled record.
 */
export const DEFAULT_CONFIRMATIONS: Record<'evm' | 'bitcoin' | 'solana', number> = {
  // EVM has no finality rule of its own; this is the conventional depth at
  // which an exchange treats a deposit as spendable.
  evm: 12,
  // Bitcoin blocks are ~10 minutes apart, so six is an hour.
  bitcoin: 6,
  // Roughly the point at which a forked slot is no longer expected to win.
  solana: 32,
};

/** An unsigned intent that is never acted on expires rather than lingering. */
export const DEFAULT_INTENT_TTL_MINUTES = 15;