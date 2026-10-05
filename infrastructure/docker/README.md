# Local development dependencies

```bash
pnpm db:up      # start Postgres + Redis
pnpm db:down    # stop
pnpm db:logs    # tail
pnpm db:reset   # destroy volumes and start clean — wipes all data
pnpm migrate    # create + apply a migration (development only)
pnpm seed       # chains, provider shells, dev jurisdiction rule, first admin
```

## Host ports

| Service | Host | Container |
|---|---|---|
| Postgres | **5433** | 5432 |
| Redis | **6380** | 6379 |

Port 5432 is occupied by another project's container, so Correnthian binds 5433.
The container ports are standard, so `DATABASE_URL` differs only in the port.

## Bootstrap an admin

```bash
ADMIN_EMAIL=you@correnthian.com ADMIN_PASSWORD='at-least-12-characters' pnpm seed
```

The seed refuses to create an admin with a short password and creates nothing if
both variables are unset.

## What the seed deliberately does not do

It does **not** seed invented metals with real issuer, custodian or vault names.
An unverified row in the registry is indistinguishable from a verified one once
it reaches a user, which is the exact failure this product exists to prevent.
Real metals assets are added by a human, from due diligence.

Providers are seeded **disabled**. A provider becomes active only after a
contracted agreement and a completed review.
