-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'FAILED', 'REFUNDED');

-- AlterTable
ALTER TABLE "Payments" ADD COLUMN     "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING';
