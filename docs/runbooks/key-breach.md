# Runbook: suspected key-boundary breach

**Severity: highest.** If key material reached Correnthian servers, the product's
core promise is broken until proven otherwise.

## Symptoms

- `node scripts/check-key-boundary.mjs` or `check-secrets.mjs` fails in CI
- A log, audit row, error report, or screenshot contains a seed phrase,
  private key, or signing share
- `packages/wallet-core` gains an HTTP client, RPC endpoint, or provider SDK
  in its dependency graph

## What the system does on its own

- Nothing automatic. Detection is CI + human review. There is no auto-quarantine:
  a silent auto-response to a trust event would hide it.

## Respond

1. **Contain.** Identify every store the material reached (logs, `AuditLog.metadata`,
   Sentry, run ledger). Do not delete yet — record locations first.
2. **Scope.** `git log` the introducing change; list every deployment carrying it.
3. **Rotate.** Rotate any credential that shared the store (RPC keys, session
   secrets, webhook secrets). Revoke Alchemy/Infura keys and reissue.
4. **Purge.** Delete the material from each store, then verify with the two
   scripts above (both exit 0) plus a targeted grep.
5. **Disclose.** If user funds could be affected, say so plainly to affected
   users before the fix ships, not after. Counsel owns the wording.
6. **Record.** File a DEF entry in `docs/agent/BACKEND_TASKS.md` with cause and
   fix; recount §21 via `node scripts/check-task-counts.mjs`.

## Escalate when

- The material is a *user's* key/seed rather than infrastructure: counsel +
  owner immediately, before containment decisions.
- The exposure window is unknown: assume the worst window (first bad deploy
  to purge) in all communications.
