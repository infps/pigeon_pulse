-- Soft delete of a bird's event entry (restorable). No backfill: existing rows stay live.

-- AlterTable
ALTER TABLE "EventInventoryItem" ADD COLUMN     "DELETED_AT" TIMESTAMP(3),
ADD COLUMN     "DELETED_BY" TEXT;
