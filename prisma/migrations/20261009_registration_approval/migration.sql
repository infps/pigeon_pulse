-- Registration approval (waiting -> approved / rejected) and "refund owed".

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('WAITING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('OWED', 'ISSUED');

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'REGISTRATION_APPROVED';
ALTER TYPE "NotificationKind" ADD VALUE 'REGISTRATION_REJECTED';

-- AlterTable
-- Backfill: the default marks every existing registration APPROVED.
ALTER TABLE "EventInventory" ADD COLUMN     "APPROVAL_STATUS" "RegistrationStatus" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN     "APPROVED_AT" TIMESTAMP(3),
ADD COLUMN     "APPROVED_BY" TEXT,
ADD COLUMN     "REJECTED_AT" TIMESTAMP(3);

-- AlterTable
-- Backfill: existing refunds are money already returned.
ALTER TABLE "Refunds" ADD COLUMN     "STATUS" "RefundStatus" NOT NULL DEFAULT 'ISSUED';
