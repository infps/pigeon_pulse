-- Scanner-to-group mapping, from the 2026-07-02 client meeting:
-- "Map scanner serial number -> loft section; auto-assign birds on scan."
--
-- Also from that meeting: "Scanner serial not logged on connect; per-scan serial
-- not shown in log." The serial was in fact already stored per scan on RfidScans
-- (SCANNER_ID); what was missing was a way to make it mean something. A mapping
-- turns a serial into a loft section, so scanning at a pen files the bird there
-- without anybody typing.

CREATE TABLE IF NOT EXISTS "ScannerMappings" (
  "ID_SCANNER_MAPPING" SERIAL PRIMARY KEY,
  "SEASON_ID"      INTEGER NOT NULL,
  "SCANNER_SERIAL" TEXT NOT NULL,
  "ID_EVENT_GROUP" INTEGER,
  "LABEL"          TEXT,
  "IS_ACTIVE"      BOOLEAN NOT NULL DEFAULT true,
  "LAST_SEEN_AT"   TIMESTAMP(3),
  "SCAN_COUNT"     INTEGER NOT NULL DEFAULT 0,
  "CREATED_AT"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ScannerMappings_season_fkey"
    FOREIGN KEY ("SEASON_ID") REFERENCES "Seasons"("id") ON DELETE CASCADE,
  CONSTRAINT "ScannerMappings_group_fkey"
    FOREIGN KEY ("ID_EVENT_GROUP") REFERENCES "EventGroup"("id") ON DELETE SET NULL,
  -- One meaning per serial within a season.
  CONSTRAINT "ScannerMappings_unique_serial"
    UNIQUE ("SEASON_ID", "SCANNER_SERIAL")
);

CREATE INDEX IF NOT EXISTS "ScannerMappings_season_idx"
  ON "ScannerMappings" ("SEASON_ID");
