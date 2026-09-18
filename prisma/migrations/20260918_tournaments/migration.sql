-- Tournament / knockout racing.
--
-- Listed in the reference document as planned: birds eliminated round by round
-- on a position cutoff, cut modes of top-N-percent / top-N-absolute / manual,
-- admin-triggered round advancement, and a guard against advancing while any
-- bird is still in the air.
--
-- A tournament sits over ordinary races rather than replacing them: each round
-- points at one Race, so scanning, results and prize money work exactly as they
-- already do. The tournament only decides who is still in.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TournamentCutMode') THEN
    CREATE TYPE "TournamentCutMode" AS ENUM ('TOP_PERCENT', 'TOP_N', 'MANUAL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TournamentStatus') THEN
    CREATE TYPE "TournamentStatus" AS ENUM ('SETUP', 'RUNNING', 'COMPLETE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TournamentRoundStatus') THEN
    CREATE TYPE "TournamentRoundStatus" AS ENUM ('PENDING', 'FLYING', 'CUT_APPLIED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Tournaments" (
  "ID_TOURNAMENT" SERIAL PRIMARY KEY,
  "SEASON_ID"     INTEGER NOT NULL,
  "NAME"          TEXT NOT NULL,
  "CUT_MODE"      "TournamentCutMode" NOT NULL DEFAULT 'TOP_PERCENT',
  -- Percent when TOP_PERCENT, an absolute count when TOP_N, ignored for MANUAL.
  "CUT_VALUE"     DOUBLE PRECISION NOT NULL DEFAULT 50,
  "STATUS"        "TournamentStatus" NOT NULL DEFAULT 'SETUP',
  "CREATED_AT"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Tournaments_season_fkey"
    FOREIGN KEY ("SEASON_ID") REFERENCES "Seasons"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "Tournaments_season_idx" ON "Tournaments" ("SEASON_ID");

CREATE TABLE IF NOT EXISTS "TournamentRounds" (
  "ID_TOURNAMENT_ROUND" SERIAL PRIMARY KEY,
  "ID_TOURNAMENT" INTEGER NOT NULL,
  "ROUND_NUMBER"  INTEGER NOT NULL,
  "ID_RACE"       INTEGER,
  -- Per-round override; falls back to the tournament setting when null.
  "CUT_MODE"      "TournamentCutMode",
  "CUT_VALUE"     DOUBLE PRECISION,
  "STATUS"        "TournamentRoundStatus" NOT NULL DEFAULT 'PENDING',
  "SURVIVOR_COUNT" INTEGER,
  "APPLIED_AT"    TIMESTAMP(3),

  CONSTRAINT "TournamentRounds_tournament_fkey"
    FOREIGN KEY ("ID_TOURNAMENT") REFERENCES "Tournaments"("ID_TOURNAMENT") ON DELETE CASCADE,
  CONSTRAINT "TournamentRounds_race_fkey"
    FOREIGN KEY ("ID_RACE") REFERENCES "Race"("ID_RACE") ON DELETE SET NULL,
  CONSTRAINT "TournamentRounds_unique_number"
    UNIQUE ("ID_TOURNAMENT", "ROUND_NUMBER")
);

CREATE TABLE IF NOT EXISTS "TournamentEntries" (
  "ID_TOURNAMENT" INTEGER NOT NULL,
  "ID_EVENT_INVENTORY_ITEM" INTEGER NOT NULL,
  -- Null while the bird is still in. Set to the round that knocked it out.
  "ELIMINATED_ROUND" INTEGER,
  "ELIMINATED_AT"    TIMESTAMP(3),
  "FINAL_POSITION"   INTEGER,

  PRIMARY KEY ("ID_TOURNAMENT", "ID_EVENT_INVENTORY_ITEM"),
  CONSTRAINT "TournamentEntries_tournament_fkey"
    FOREIGN KEY ("ID_TOURNAMENT") REFERENCES "Tournaments"("ID_TOURNAMENT") ON DELETE CASCADE,
  CONSTRAINT "TournamentEntries_item_fkey"
    FOREIGN KEY ("ID_EVENT_INVENTORY_ITEM") REFERENCES "EventInventoryItem"("ID_EVENT_INVENTORY_ITEM") ON DELETE CASCADE
);

-- "Who is still in" is the hottest query in the feature.
CREATE INDEX IF NOT EXISTS "TournamentEntries_alive_idx"
  ON "TournamentEntries" ("ID_TOURNAMENT") WHERE "ELIMINATED_ROUND" IS NULL;
