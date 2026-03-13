-- Add RaceFeeMode enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RaceFeeMode') THEN
    CREATE TYPE "RaceFeeMode" AS ENUM ('PER_BIRD_PER_RACE', 'FLAT_PER_RACE');
  END IF;
END $$;

-- Add raceFeeMode column to FeeScheme
ALTER TABLE "FeeScheme" ADD COLUMN IF NOT EXISTS "RACE_FEE_MODE" "RaceFeeMode" NOT NULL DEFAULT 'PER_BIRD_PER_RACE';

-- Add raceFeeValue column to EventInventoryItem
ALTER TABLE "EventInventoryItem" ADD COLUMN IF NOT EXISTS "RACE_FEE_VALUE" DOUBLE PRECISION;
