-- Rename constraints to match new table name
ALTER TABLE "BirdFeeItem" RENAME CONSTRAINT "PerchFeeItem_pkey" TO "BirdFeeItem_pkey";
ALTER TABLE "BirdFeeItem" RENAME CONSTRAINT "PerchFeeItem_feeSchemeId_fkey" TO "BirdFeeItem_feeSchemeId_fkey";
