# Runbook: stuck transaction (drops, reorgs, confirmation stall)

## Symptoms

- Row sits in `broadcast`/`pending` past its expected depth; `dropCount`
  climbing; `permittedNext` on the detail view shows the legal edges
- User reports "sent but nothing arrived" with a hash

## What the system does on its own

- Observation path records depth facts; falling below required depth
  demotes confirmed → pending and counts a drop (reorgs look exactly so).
- Drops are facts on the row, not new rows — one row per hash, always.
- `index-transactions` advances or demotes every row to what the current
  head implies; `transaction.expire-intents` retires unsigned intents only —
  never anything on the network.

## Respond

1. **Read the row, not the user's description.** Transaction detail shows
   state, confirmations vs required depth, drop count, timeline, and the
   edges the lifecycle table currently permits. Believe it over the report.
2. **Confirm the hash on-chain** (CLI: `alchemy evm tx <hash> -n <network>`,
   then `receipt`). If the chain never saw it, the row is an intent/report
   problem, not a money problem — check `errorCode`/`errorMessage`.
3. **If dropped from mempool:** the row stays; a re-broadcast is the same
   transaction coming back and the drop counter says so. Do not create a
   second row for the same movement.
4. **If confirmations froze:** suspect RPC first (see `rpc-outage.md`),
   not the row. Counting resumes when reads return — verify one row
   advances.
5. **Never force a state.** Transitions go through the lifecycle table;
   an edge the table refuses is information (usually: wrong row, or two
   operators disagreeing), not an obstacle to route around.

## Escalate when

- Funds provably left but never arrived at the destination with confirmations
  complete: freeze related intents, preserve the row + receipts, owner +
  counsel before any manual remediation.
