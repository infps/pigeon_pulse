-- Escalating late-payment penalty, from the 2026-07-02 client meeting:
-- "Late payment after deadline incurs escalating fee; admin can waive with proof."
--
-- The deadline is the payment-required race's start time, which is the same
-- anchor the defaulter window already uses (it opens 7 days before). Penalties
-- are assessed rows rather than a computed number, so an assessment can be
-- waived, audited and reversed without recomputing history.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LatePenaltyMode') THEN
    CREATE TYPE "LatePenaltyMode" AS ENUM ('NONE', 'FLAT', 'PER_DAY', 'PER_WEEK');
  END IF;
END $$;

ALTER TABLE "FeeScheme"
  ADD COLUMN IF NOT EXISTS "LATE_PENALTY_MODE"  "LatePenaltyMode" NOT NULL DEFAULT 'NONE',
  -- Flat amount, or the amount per day / per week once the grace period ends.
  ADD COLUMN IF NOT EXISTS "LATE_PENALTY_AMOUNT" DOUBLE PRECISION,
  -- Ceiling, so an old debt cannot grow without limit.
  ADD COLUMN IF NOT EXISTS "LATE_PENALTY_CAP"    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "LATE_PENALTY_GRACE_DAYS" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "PaymentPenalties" (
  "ID_PENALTY" SERIAL PRIMARY KEY,
  "ID_EVENT_INVENTORY" INTEGER NOT NULL,
  "ID_RACE"            INTEGER,
  "DAYS_LATE"          INTEGER NOT NULL,
  "AMOUNT"             DOUBLE PRECISION NOT NULL,
  "OUTSTANDING_AT_ASSESSMENT" DOUBLE PRECISION,
  "ASSESSED_AT"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ASSESSED_BY"        TEXT,
  -- Waiver: who, when, why, and the proof they were shown.
  "WAIVED_AT"          TIMESTAMP(3),
  "WAIVED_BY"          TEXT,
  "WAIVER_REASON"      TEXT,
  "WAIVER_PROOF_URL"   TEXT,
  "WAIVER_PROOF_KEY"   TEXT,

  CONSTRAINT "PaymentPenalties_inventory_fkey"
    FOREIGN KEY ("ID_EVENT_INVENTORY") REFERENCES "EventInventory"("ID_EVENT_INVENTORY") ON DELETE CASCADE,
  CONSTRAINT "PaymentPenalties_race_fkey"
    FOREIGN KEY ("ID_RACE") REFERENCES "Race"("ID_RACE") ON DELETE SET NULL
);

-- One live assessment per registration per race; a waived row stays for audit.
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentPenalties_one_live_per_race"
  ON "PaymentPenalties" ("ID_EVENT_INVENTORY", "ID_RACE")
  WHERE "WAIVED_AT" IS NULL;

CREATE INDEX IF NOT EXISTS "PaymentPenalties_inventory_idx"
  ON "PaymentPenalties" ("ID_EVENT_INVENTORY");
