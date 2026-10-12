# Runbook: database or Redis outage

## Symptoms

- `GET /health/ready` answers 503 with `dependencies` naming the down
  dependency (orchestrator should divert traffic on status code alone)
- Broad 429s with the database down: the rate limiter fails closed and
  refuses every request rather than serving unmetered
- Jobs stop ticking; run ledger shows gaps, not failures

## What the system does on its own

- Readiness reports honestly (200 only when both deps are up). Liveness
  (`GET /health/live`) stays 200 — a DB outage must not get the process killed.
- Nothing serves stale data as fresh: prices older than the freshness
  threshold read as stale, confirmations freeze, gates keep denying.

## Respond

1. **Confirm which dependency.** The 503 body names it (`database` / `redis`).
2. **Database:** check Neon/project status, connection count, and recent
   migrations. Never run `prisma migrate dev` against a shared database —
   diff against a scratch shadow DB, apply with `migrate deploy`.
3. **Redis:** provider status; the cache/queue rebuilds itself — Redis is
   never the source of truth, so no restore procedure exists or is needed.
   Rate-limit counters and job leases re-form on reconnect.
4. **Verify recovery.** `ready` back to 200, then one write path smoketest
   (e.g. register → read → delete a wallet in dev first if prod is suspect),
   then watch the next two scheduler ticks land in the run ledger.

## Escalate when

- Data loss suspected (not just unavailability): stop writes, snapshot,
  counsel + owner before any repair. There is no routine for rewriting
  history — a rewritten ledger is worse than a gap.
