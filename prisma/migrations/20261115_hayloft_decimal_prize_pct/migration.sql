-- HayLoft stores average-speed prizes and Standard Show place percentages as
-- NUMERIC(15,4). These two columns were created as INTEGER, which would cut a
-- value like 33.33% down to 33. No existing value has decimals (checked
-- 2026-11-15: 99 prizes, 19 percentages), so this changes no data.
ALTER TABLE "AvgWinnerPrizes" ALTER COLUMN "PRIZE_VALUE" SET DATA TYPE DOUBLE PRECISION;
ALTER TABLE "StandardShowPercentage" ALTER COLUMN "PERC_VALUE" SET DATA TYPE DOUBLE PRECISION;
