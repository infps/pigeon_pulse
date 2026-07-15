-- Idempotent rewrite: LoftGroup + VaccinationRecord (superseded by 20260713_unify_groups)

DO $$ BEGIN CREATE TYPE "LoftGroupStatus" AS ENUM ('OPEN', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "LoftGroup" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "groupNo" INTEGER NOT NULL,
    "status" "LoftGroupStatus" NOT NULL DEFAULT 'OPEN',
    "capacity" INTEGER NOT NULL DEFAULT 150,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    CONSTRAINT "LoftGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "VaccinationRecord" (
    "id" SERIAL NOT NULL,
    "loftGroupId" INTEGER,
    "vaccineName" TEXT NOT NULL DEFAULT '',
    "vaccinationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vet" TEXT,
    "batchNo" TEXT,
    "notes" TEXT,
    "documentUrl" TEXT,
    "documentKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VaccinationRecord_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "EventInventoryItem" ADD COLUMN IF NOT EXISTS "ID_LOFT_GROUP" INTEGER;

DO $$ BEGIN ALTER TABLE "EventBaskets" DROP CONSTRAINT "EventBaskets_ID_EVENT_BASKET_NO_PHASE_key";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "EventBaskets_ID_EVENT_BASKET_NO_PHASE_ID_RACE_key" ON "EventBaskets"("ID_EVENT", "BASKET_NO", "PHASE", "ID_RACE");

DO $$ BEGIN ALTER TABLE "LoftGroup" ADD CONSTRAINT "LoftGroup_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Events"("ID_EVENT") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "VaccinationRecord" ADD CONSTRAINT "VaccinationRecord_loftGroupId_fkey" FOREIGN KEY ("loftGroupId") REFERENCES "LoftGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "EventInventoryItem" ADD CONSTRAINT "EventInventoryItems_ID_LOFT_GROUP_fkey" FOREIGN KEY ("ID_LOFT_GROUP") REFERENCES "LoftGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "LoftGroup_eventId_groupNo_key" ON "LoftGroup"("eventId", "groupNo");
CREATE INDEX IF NOT EXISTS "LoftGroup_eventId_status_idx" ON "LoftGroup"("eventId", "status");
