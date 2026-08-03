-- Add BirdImageType enum and BirdImages table

CREATE TYPE "BirdImageType" AS ENUM ('ARRIVAL', 'RACE', 'FINAL');

CREATE TABLE "BirdImages" (
    "id"        SERIAL          NOT NULL,
    "BIRD_ID"   INTEGER         NOT NULL,
    "SEASON_ID" INTEGER         NOT NULL,
    "TYPE"      "BirdImageType" NOT NULL,
    "URL"       TEXT            NOT NULL,
    "S3_KEY"    TEXT            NOT NULL,
    "TAKEN_AT"  TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BirdImages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BirdImages_BIRD_ID_SEASON_ID_TYPE_idx" ON "BirdImages"("BIRD_ID", "SEASON_ID", "TYPE");

ALTER TABLE "BirdImages"
    ADD CONSTRAINT "BirdImages_BIRD_ID_fkey"
    FOREIGN KEY ("BIRD_ID") REFERENCES "Birds"("ID_BIRD") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BirdImages"
    ADD CONSTRAINT "BirdImages_SEASON_ID_fkey"
    FOREIGN KEY ("SEASON_ID") REFERENCES "Seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
