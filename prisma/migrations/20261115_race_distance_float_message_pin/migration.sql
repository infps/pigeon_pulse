-- Race distance: Int -> Float (keep fractional miles, e.g. 312.457)
ALTER TABLE "Race" ALTER COLUMN "DISTANCE" SET DATA TYPE DOUBLE PRECISION;

-- Pinned announcements
ALTER TABLE "EventMessages" ADD COLUMN "IS_PINNED" BOOLEAN NOT NULL DEFAULT false;
