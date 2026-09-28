-- Portal content: event rules and fees, videos, refunds, and guest tab masking.
--
-- Four small features that share one migration because they are all "things an
-- organizer publishes or records about a season".

-- === Event rules & fees ===========================================
-- AGN's rules page is a stack of headed sections: Perch Fees, Accepting Birds,
-- Total Payout, Race Schedule, General Rules, Activation, Refunded Payments,
-- Bird Management, Teams/Syndicates, Prize and Payout, Return/Shipping.
-- Sections rather than one blob, so an organizer can reorder and republish a
-- single part without retyping the page.
CREATE TABLE IF NOT EXISTS "EventRuleSections" (
  "ID_RULE_SECTION" SERIAL PRIMARY KEY,
  "SEASON_ID"  INTEGER NOT NULL,
  "TITLE"      TEXT NOT NULL,
  -- Markdown: the page needs lists and emphasis, and it already renders
  -- markdown elsewhere.
  "BODY"       TEXT NOT NULL DEFAULT '',
  "SORT_ORDER" INTEGER NOT NULL DEFAULT 0,
  "IS_PUBLISHED" BOOLEAN NOT NULL DEFAULT true,
  "UPDATED_AT" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "UPDATED_BY" TEXT,

  CONSTRAINT "EventRuleSections_season_fkey"
    FOREIGN KEY ("SEASON_ID") REFERENCES "Seasons"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "EventRuleSections_season_idx"
  ON "EventRuleSections" ("SEASON_ID", "SORT_ORDER");

-- === Videos =======================================================
-- The Videos column on WinCompanion's handler menu. Links rather than uploads:
-- these are YouTube race recordings, and hosting video is not this system's job.
CREATE TABLE IF NOT EXISTS "EventVideos" (
  "ID_VIDEO"    SERIAL PRIMARY KEY,
  "SEASON_ID"   INTEGER NOT NULL,
  "ID_RACE"     INTEGER,
  "TITLE"       TEXT NOT NULL,
  "URL"         TEXT NOT NULL,
  "DESCRIPTION" TEXT,
  "PUBLISHED_AT" TIMESTAMP(3),
  "SORT_ORDER"  INTEGER NOT NULL DEFAULT 0,
  "IS_PUBLIC"   BOOLEAN NOT NULL DEFAULT true,
  "CREATED_AT"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EventVideos_season_fkey"
    FOREIGN KEY ("SEASON_ID") REFERENCES "Seasons"("id") ON DELETE CASCADE,
  CONSTRAINT "EventVideos_race_fkey"
    FOREIGN KEY ("ID_RACE") REFERENCES "Race"("ID_RACE") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "EventVideos_season_idx" ON "EventVideos" ("SEASON_ID");

-- === Refunds ======================================================
-- The Refunds column. A refund is recorded against the registration it returns
-- money to, kept as its own row rather than by mutating the original payment,
-- so the history shows both what was charged and what came back.
CREATE TABLE IF NOT EXISTS "Refunds" (
  "ID_REFUND"  SERIAL PRIMARY KEY,
  "ID_EVENT_INVENTORY" INTEGER NOT NULL,
  "ID_PAYMENT" INTEGER,
  "AMOUNT"     DOUBLE PRECISION NOT NULL,
  "REASON"     TEXT,
  "METHOD"     TEXT,
  "REFERENCE"  TEXT,
  "ISSUED_AT"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ISSUED_BY"  TEXT,

  CONSTRAINT "Refunds_inventory_fkey"
    FOREIGN KEY ("ID_EVENT_INVENTORY") REFERENCES "EventInventory"("ID_EVENT_INVENTORY") ON DELETE CASCADE,
  CONSTRAINT "Refunds_payment_fkey"
    FOREIGN KEY ("ID_PAYMENT") REFERENCES "Payments"("ID_PAYMENT") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "Refunds_inventory_idx" ON "Refunds" ("ID_EVENT_INVENTORY");

-- === Guest tab masking ============================================
-- One Loft gates individual tabs behind sign-in rather than hiding the whole
-- organization. A row here means "this tab needs an account"; absence means
-- public, so an event with no rows behaves exactly as it does today.
CREATE TABLE IF NOT EXISTS "EventTabVisibility" (
  "ID_EVENT"       INTEGER NOT NULL,
  "TAB"            TEXT NOT NULL,
  "REQUIRES_SIGNIN" BOOLEAN NOT NULL DEFAULT true,

  PRIMARY KEY ("ID_EVENT", "TAB"),
  CONSTRAINT "EventTabVisibility_event_fkey"
    FOREIGN KEY ("ID_EVENT") REFERENCES "Events"("ID_EVENT") ON DELETE CASCADE
);
