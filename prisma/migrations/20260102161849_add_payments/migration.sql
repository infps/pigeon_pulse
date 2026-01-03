-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CREDIT_CARD', 'PAYPAL', 'BANK_TRANSFER', 'CASH');

-- CreateTable
CREATE TABLE "Payments" (
    "paymentId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "method" "PaymentMethod" NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "eventInventoryId" TEXT NOT NULL,
    "breederId" TEXT NOT NULL,
    "paymentType" TEXT NOT NULL,
    "referenceNumber" TEXT,

    CONSTRAINT "Payments_pkey" PRIMARY KEY ("paymentId")
);

-- AddForeignKey
ALTER TABLE "Payments" ADD CONSTRAINT "Payments_eventInventoryId_fkey" FOREIGN KEY ("eventInventoryId") REFERENCES "EventInventory"("eventInventoryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payments" ADD CONSTRAINT "Payments_breederId_fkey" FOREIGN KEY ("breederId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
