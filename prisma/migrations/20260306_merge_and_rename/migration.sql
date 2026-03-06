-- ============================================
-- 1. NEW COLUMNS (all with defaults, no data impact)
-- ============================================

-- AlterTable: FeeScheme
ALTER TABLE "FeeScheme" ADD COLUMN "minEntryFees" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "FeeScheme" ADD COLUMN "maxBackupBirdCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "FeeScheme" ADD COLUMN "isFloatingBackup" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FeeScheme" ADD COLUMN "hotSpot1Fee" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "FeeScheme" ADD COLUMN "hotSpot2Fee" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "FeeScheme" ADD COLUMN "hotSpot3Fee" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "FeeScheme" ADD COLUMN "hotSpotFinalFee" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable: BettingScheme
ALTER TABLE "BettingScheme" ADD COLUMN "standardShow6" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- ============================================
-- 2. NEW TABLE: StandardShowPercentage
-- ============================================

CREATE TABLE "StandardShowPercentage" (
    "id" TEXT NOT NULL,
    "bettingSchemeId" TEXT NOT NULL,
    "place" INTEGER NOT NULL,
    "percValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    CONSTRAINT "StandardShowPercentage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StandardShowPercentage_bettingSchemeId_place_key" ON "StandardShowPercentage"("bettingSchemeId", "place");

ALTER TABLE "StandardShowPercentage" ADD CONSTRAINT "StandardShowPercentage_bettingSchemeId_fkey"
    FOREIGN KEY ("bettingSchemeId") REFERENCES "BettingScheme"("bettingSchemeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- 3. COLUMN RENAMES (data preserved)
-- ============================================

ALTER TABLE "FeeScheme" RENAME COLUMN "entryFee" TO "perchFee";
ALTER TABLE "EventInventoryItem" RENAME COLUMN "entryFeeRefunded" TO "perchFeeRefunded";
ALTER TABLE "EventInventoryItem" RENAME COLUMN "entryFeePaid" TO "perchFeePaid";

-- ============================================
-- 4. TABLE RENAME
-- ============================================

ALTER TABLE "PerchFeeItem" RENAME TO "BirdFeeItem";

-- ============================================
-- 5. ENUM VALUE RENAMES (order matters!)
-- ============================================

ALTER TYPE "PaymentType" RENAME VALUE 'PERCH_FEE' TO 'BIRD_FEE';
ALTER TYPE "PaymentType" RENAME VALUE 'ENTRY_FEE' TO 'PERCH_FEE';
