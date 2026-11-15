-- The HayLoft import stamped ignore-list arrivals with status IGNORED, which
-- race-results treats as the portal's manual "drop from results". HayLoft ranks
-- ignore-list birds, so they are ARRIVED. Manual IGNORED never writes a
-- RaceIgnoreBird row, so it is left alone.
UPDATE "RaceItem" ri
SET "status" = 'ARRIVED'
WHERE ri."status" = 'IGNORED'
  AND EXISTS (
    SELECT 1 FROM "RaceIgnoreBird" ib
    WHERE ib."ID_RACE" = ri."ID_RACE"
      AND ib."ID_EVENT_INVENTORY_ITEM" = ri."ID_INVENTORY_ITEM"
  );
