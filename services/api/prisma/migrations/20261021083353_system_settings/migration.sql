-- System settings: operator overrides for settings the code declares.
--
-- ---------------------------------------------------------------------------
-- WHY THIS IS A TABLE AND NOT A COLUMN PER SETTING
--
-- A setting is a value the platform's behaviour depends on: how long a
-- transaction intent lives, how stale a sanctions screen may be, whether the
-- platform is in maintenance. Those change for business reasons, not code
-- reasons, and a value compiled into a service needs a release to change.
--
-- One column per setting would mean a migration per setting, and — worse — a
-- place where a setting's *type* and *bounds* live in the database while its
-- default lives in code. Two homes for one fact.
--
-- So the definition stays in code: `services/api/src/settings/registry.ts`
-- names every key, its type, its bounds and its default, and this table
-- records only where an operator has replaced that default. The effective
-- value is `override ?? default`.
--
-- That is what keeps a setting from being a row nobody reads. A row here is
-- never the definition of a setting; the code is. A key that no service reads
-- is caught by a test that fails the build, not by an operator noticing.
--
-- ---------------------------------------------------------------------------
-- WHY THE VALUE IS JSON
--
-- The database cannot enforce a value that depends on which key it is, so
-- the validation lives in the registry, on the way in and on the way out. A
-- stored value that a later code change made invalid falls back to the
-- declared default rather than wedging the platform.
--
-- The cost of `Json` is that nothing but the settings module may read or
-- write this table. A read that bypasses the registry skips the validation
-- and the fallback, and would reintroduce the exact defect class this table
-- exists to remove.
--
-- ---------------------------------------------------------------------------
-- SECURITY INVARIANT
--
-- This table holds configuration. It adds no column capable of holding key
-- material, no signed payload and no user secret. Nothing that could move
-- user funds may be written here, and no setting declared in the registry may
-- describe a key, a seed or a signing share.
--
-- ---------------------------------------------------------------------------
-- NO SEEDED VALUE
--
-- The table starts empty. An empty table means every setting is at its
-- declared default, which is the behaviour the code already has — so applying
-- this migration changes nothing, and there is no stored value that some
-- environment agreed to and another did not.

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);
