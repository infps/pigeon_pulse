-- Bird status lifecycle: the statuses the spec locked on 2026-09-16 but that
-- were never added to the schema, plus bird-level health.
--
-- RaceItemStatus gains three values:
--   STRAY   — a lost bird reappears with a later flock; no position awarded
--   IGNORED — the admin excludes this flight ("did not fly")
--   LOST    — lost as a persisted status, not only a boolean on Bird
--
-- PostgreSQL 12+ allows ALTER TYPE ... ADD VALUE inside a transaction as long
-- as the new value is not used in that same transaction. Nothing below uses
-- them, so this is safe under Prisma's transactional migration runner.

ALTER TYPE "RaceItemStatus" ADD VALUE IF NOT EXISTS 'STRAY';
ALTER TYPE "RaceItemStatus" ADD VALUE IF NOT EXISTS 'IGNORED';
ALTER TYPE "RaceItemStatus" ADD VALUE IF NOT EXISTS 'LOST';

-- Bird health is separate from race status: a bird can be healthy and lost, or
-- present and unfit to fly. allowedToFly is derived from this, not stored.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BirdHealthStatus') THEN
    CREATE TYPE "BirdHealthStatus" AS ENUM ('HEALTHY', 'INJURED', 'HOSPITALIZED', 'DEAD');
  END IF;
END $$;

ALTER TABLE "Birds"
  ADD COLUMN IF NOT EXISTS "HEALTH_STATUS" "BirdHealthStatus" NOT NULL DEFAULT 'HEALTHY',
  ADD COLUMN IF NOT EXISTS "HEALTH_NOTE"   TEXT,
  ADD COLUMN IF NOT EXISTS "HEALTH_UPDATED_AT" TIMESTAMP(3);

-- Birds already marked dead in the legacy note field stay HEALTHY here; there
-- is no reliable signal in the migrated data to derive a health status from,
-- so this starts clean and is set going forward by the admin.
