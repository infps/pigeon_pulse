-- Self-check for migration 20261116_entry_fee_paid_from_payments. Always rolls back.
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v inv=<ID_EVENT_INVENTORY, entry fees posted, >=3 birds> \
--        [-v migrate=1] -f scripts/verify-entry-fee-paid.sql
-- migrate=1 applies the migration inside the transaction first (pre-deploy check).
BEGIN;
\if :{?migrate}
\i prisma/migrations/20261116_entry_fee_paid_from_payments/migration.sql
\endif
SELECT set_config('v.inv', :'inv', true);

CREATE TEMP VIEW paid AS
  SELECT count(*) FILTER (WHERE "ENTRY_FEE_PAID" = 1) AS n,
         array_agg("BIRD_NO" ORDER BY "BIRD_NO") FILTER (WHERE "ENTRY_FEE_PAID" = 1) AS birds
  FROM "EventInventoryItem"
  WHERE "ID_EVENT_INVENTORY" = current_setting('v.inv')::int AND "DELETED_AT" IS NULL;

DELETE FROM "Payments" WHERE "ID_EVENT_INVENTORY" = current_setting('v.inv')::int AND "PAYMENT_TYPE" = 1;
DO $$ BEGIN ASSERT (SELECT n FROM paid) = 0, 'no entry payment -> none paid'; END $$;

-- 2.5 birds' worth of entry fee, PAID: exactly the two lowest bird numbers.
INSERT INTO "Payments" ("ID_EVENT_INVENTORY", "PAYMENT_VALUE", "PAYMENT_TYPE", status)
SELECT current_setting('v.inv')::int, 2.5 * min("ENTRY_FEE_VALUE"), 1, 'PAID'
FROM "EventInventoryItem" WHERE "ID_EVENT_INVENTORY" = current_setting('v.inv')::int AND "DELETED_AT" IS NULL;
DO $$ BEGIN ASSERT (SELECT n FROM paid) = 2, 'partial payment covers 2 birds'; END $$;

-- Payment reversed (status flips) -> flags go back to 0.
UPDATE "Payments" SET status = 'REFUNDED' WHERE "ID_EVENT_INVENTORY" = current_setting('v.inv')::int AND "PAYMENT_TYPE" = 1;
DO $$ BEGIN ASSERT (SELECT n FROM paid) = 0, 'refunded payment -> none paid'; END $$;

-- PENDING never counts.
UPDATE "Payments" SET status = 'PENDING' WHERE "ID_EVENT_INVENTORY" = current_setting('v.inv')::int AND "PAYMENT_TYPE" = 1;
DO $$ BEGIN ASSERT (SELECT n FROM paid) = 0, 'pending payment -> none paid'; END $$;

-- Paid again, then entry fee raised on bird list (bulk item update) -> re-allocated.
UPDATE "Payments" SET status = 'PAID' WHERE "ID_EVENT_INVENTORY" = current_setting('v.inv')::int AND "PAYMENT_TYPE" = 1;
UPDATE "EventInventoryItem" SET "ENTRY_FEE_VALUE" = "ENTRY_FEE_VALUE" * 2
WHERE "ID_EVENT_INVENTORY" = current_setting('v.inv')::int AND "DELETED_AT" IS NULL;
DO $$ BEGIN ASSERT (SELECT n FROM paid) = 1, 'doubled fee -> payment covers 1 bird'; END $$;

SELECT 'entry-fee-paid self-check OK' AS result, * FROM paid;
ROLLBACK;
