-- Per-bird, per-season note timeline. Client asked the bird detail popup to
-- show every note left over time instead of one overwritable field. Append-only
-- from the UI; author denormalized so the timeline reads without a user join.

CREATE TABLE IF NOT EXISTS "BirdNotes" (
  "id"          SERIAL PRIMARY KEY,
  "BIRD_ID"     INTEGER NOT NULL,
  "SEASON_ID"   INTEGER NOT NULL,
  "TEXT"        TEXT NOT NULL,
  "AUTHOR_ID"   TEXT,
  "AUTHOR_NAME" TEXT,
  "CREATED_AT"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BirdNotes_bird_fkey"
    FOREIGN KEY ("BIRD_ID") REFERENCES "Birds"("ID_BIRD") ON DELETE CASCADE,
  CONSTRAINT "BirdNotes_season_fkey"
    FOREIGN KEY ("SEASON_ID") REFERENCES "Seasons"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "BirdNotes_bird_season_idx"
  ON "BirdNotes" ("BIRD_ID", "SEASON_ID");
