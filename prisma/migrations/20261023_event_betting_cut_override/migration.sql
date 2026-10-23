-- Per-event override of the betting scheme's house cut %. NULL = use scheme value.
-- AlterTable
ALTER TABLE "Events" ADD COLUMN     "BETTING_CUT_OVERRIDE" DOUBLE PRECISION;
