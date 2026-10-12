# Runbook: RPC outage (all or some endpoints down)

## Symptoms

- `GET /blockchain/health` shows `healthy: false` for a chain (support role)
- Jobs page shows `blockchain.index-transactions` as `failing` with
  "No RPC endpoint is configured" or "All N RPC endpoint(s) failed"
- Transaction endpoints answer 503 `provider_unavailable`; sync errors grow

## What the system does on its own

- The `RpcPool` quarantines failing endpoints and retries across the rest —
  one vendor down is degraded, not down. No single provider is authoritative.
- Indexing/transitions keep serving reads from the database; only fresh
  chain state stops. Confirmation counting freezes rather than guesses.
- Scheduler marks missed runs `overdue` in the run ledger; they resume,
  they don't pile up (leases prevent overlap).

## Respond

1. **Read health, not logs first.** `GET /blockchain/health` names the sick
   chain; the jobs page names the failing job and its last error.
2. **Distinguish our config from their outage.** "No RPC endpoint is
   configured" = our gap (check `Chain.rpcUrls` — seed fills from env only
   into empty rows, never overwrites operator edits). "All N failed" = vendor
   side — check vendor status pages and `alchemy usage summary` for quota
   exhaustion before assuming an outage.
3. **Fail over manually if needed.** The pool does it automatically, but a
   dead endpoint with a long quarantine can be removed from `rpcUrls`
   temporarily; restore it after, or the next person inherits a mystery.
4. **Watch the backlog.** Pending confirmations resume counting when reads
   return — verify a sample row advances rather than assuming the sweep
   caught up.
5. **Manual run only to catch up**, via Jobs → Run now (confirm dialog),
   never on a schedule change made mid-incident.

## Escalate when

- Both vendors fail on one chain for >30 min: owner + status page check.
- Quota exhaustion: upgrade decision is commercial, not engineering.
