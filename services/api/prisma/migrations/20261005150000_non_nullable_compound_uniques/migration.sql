-- Make compound-unique columns non-nullable.
--
-- Two latent integrity problems, both invisible to `prisma migrate dev`:
--
-- 1. Prisma cannot target a nullable column in a compound unique selector,
--    so `upsert`/`findUnique` on (country, region) and
--    (chainId, contractAddress, issuerId) were both unusable at runtime.
--
-- 2. Postgres treats NULLs as distinct in a unique index, so two native
--    assets for the same chain and issuer would both be insertable. That is
--    a uniqueness hole in the registry — the one table where a duplicate
--    means a user sees the wrong backing.
--
-- Empty string is the sentinel for "does not apply": country-wide rule,
-- native asset.

UPDATE "JurisdictionRule" SET "region" = '' WHERE "region" IS NULL;
ALTER TABLE "JurisdictionRule" ALTER COLUMN "region" SET DEFAULT '';
ALTER TABLE "JurisdictionRule" ALTER COLUMN "region" SET NOT NULL;

UPDATE "Asset" SET "contractAddress" = '' WHERE "contractAddress" IS NULL;
ALTER TABLE "Asset" ALTER COLUMN "contractAddress" SET DEFAULT '';
ALTER TABLE "Asset" ALTER COLUMN "contractAddress" SET NOT NULL;
