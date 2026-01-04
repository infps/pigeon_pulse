/*
  Warnings:

  - You are about to drop the column `amount` on the `Payments` table. All the data in the column will be lost.
  - Added the required column `amountPaid` to the `Payments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `amountToPay` to the `Payments` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `paymentType` on the `Payments` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('ENTRY_FEE', 'PERCH_FEE', 'RACES_FEE', 'PAYOUTS', 'OTHER');

-- AlterTable
ALTER TABLE "Payments" DROP COLUMN "amount",
ADD COLUMN     "amountPaid" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "amountToPay" DOUBLE PRECISION NOT NULL,
DROP COLUMN "paymentType",
ADD COLUMN     "paymentType" "PaymentType" NOT NULL;
