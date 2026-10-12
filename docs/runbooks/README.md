# Runbooks

Step-by-step procedures for incidents. Each names what the system does on
its own first — the operator's job starts where automation correctly stops.

| Runbook | Covers |
|---|---|
| [key-breach](key-breach.md) | Suspected key material on servers. Highest severity. |
| [rpc-outage](rpc-outage.md) | Endpoints down or degraded; quarantine, failover, backlog. |
| [db-outage](db-outage.md) | Database or Redis down; readiness, fail-closed limits, recovery. |
| [vendor-screening](vendor-screening.md) | Persona down, webhook storms, rescreen backlog. |
| [stuck-transaction](stuck-transaction.md) | Drops, reorgs, confirmation stalls; reading the row. |
| [fee-conflict](fee-conflict.md) | Ambiguous fee rules refusing quotes; priority resolution. |

Conventions: verify with the named endpoint or script before acting; never
rewrite history (ledger gaps beat rewritten rows); counsel owns wording
whenever users or regulators are addressed.
