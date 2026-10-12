# Runbook: fee misconfiguration (quotes refusing)

## Symptoms

- Quotes fail with "the fee cannot be stated: more than one fee rule applies"
  (503 `fee_configuration_invalid`)
- Fees page shows the ambiguous-pair alert naming the operation, kind, and
  rule ids

## What the system does on its own

- Refuses rather than guesses: two rules that both claim a quote and neither
  wins means no quote, not a coin flip. The rule ids go to the log and the
  diagnostics view, never to the customer.

## Respond

1. **Open Fees → the alert names the pair.** Read `detail`: which operation
   and kind collide.
2. **Set `priority` on the rule that should win** (higher wins; reason
   required, owner role). Priority is the explicit tie-break "most specific"
   cannot provide — do not instead edit rates to dodge the collision; that
   moves the money to fix the bookkeeping.
3. **Re-run one preview** (`POST /fees/preview`) for the affected operation
   and confirm a single total before telling anyone it's fixed.
4. **If the pair should genuinely both apply** (split fee across kinds),
   that is a product decision, not an ops fix — record it and bring it to
   the owner; do not hack priority to simulate it.

## Escalate when

- A quote already executed (signed + broadcast) under an ambiguous table:
  the refusal came too late for that row. Reconcile that transaction by
  hand against both candidate rules, owner + counsel on the call.
