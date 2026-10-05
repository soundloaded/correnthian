# Production database — Neon

**Status: not yet provisioned.** The steps below require a Vercel account and
must be run by the account owner. Everything else in the stack is already
production-shaped, so this is the last blocked piece.

## Why Neon

| | Neon | Vercel Postgres | Self-managed RDS |
|---|---|---|---|
| Status | Marketplace | **No longer offered** | — |
| Branching | Per-branch databases | — | Manual |
| Scale-to-zero | Yes | — | No |
| Cold start | Sub-second | — | n/a |

Neon is the Marketplace-native Postgres. Note that Vercel Postgres and Vercel KV
are no longer offered — databases come through the Marketplace.

## Provisioning steps (requires account owner)

```bash
# 1. The installed CLI is 56.5.0; the marketplace integration flow needs current.
npm i -g vercel@latest
vercel --version

# 2. Authenticate
vercel login

# 3. Link this repository to a Vercel project
cd /path/to/correnthian
vercel link

# 4. Create the Neon database — this provisions it and sets DATABASE_URL
vercel integration add neon --yes

# 5. Confirm the environment variable landed (names only; never values)
vercel env ls

# 6. Apply migrations to the production database
pnpm migrate:deploy
```

`vercel integration add` also installs Neon's own agent skill, which should be
followed for any Neon-specific API usage rather than working from memory.

## Configuration contract

The API reads exactly one database variable. Local and production differ only
in its value.

| | Local (Docker) | Production (Neon) |
|---|---|---|
| `DATABASE_URL` | `postgresql://correnthian:correnthian_dev@localhost:5433/correnthian` | Set by the integration |
| `REDIS_URL` | `redis://localhost:6380` | Managed separately |

Prisma 7 reads the URL from `prisma.config.ts`, not from `schema.prisma`.

## Two migration hazards specific to going live

1. **Never `migrate dev` against production.** It creates migrations. Use
   `migrate deploy`, which only applies what already exists.
2. **The `region` and `contractAddress` corrections were hand-written.**
   `prisma migrate dev` reported no drift and would have left a fresh
   database structurally different from local — see the migration
   `20261005150000_non_nullable_compound_uniques`. Verify after the first
   production deploy:

```sql
SELECT table_name, column_name, is_nullable
FROM information_schema.columns
WHERE (table_name = 'JurisdictionRule' AND column_name = 'region')
   OR (table_name = 'Asset' AND column_name = 'contractAddress');
-- both must report 'NO'
```

## Before any real data

- [ ] Counsel-reviewed jurisdiction rules replace the development placeholder
- [ ] A Neon branch per environment; production is not reachable from dev
- [ ] Automated backups and a restore rehearsed, not merely enabled
- [ ] `prisma migrate deploy` in CI against a staging branch, not production
