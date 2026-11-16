-- ENTRY_FEE_PAID follows the money instead of a checkbox.
--
-- A bird's entry fee counts as paid once the registration's PAID entry-fee
-- payments (type 1) cover it, allocating to birds in bird-number order —
-- the order HayLoft admins ticked them in (matches 98–100% of the imported
-- flags). The final race ranks only paid birds (race-results recalcPositions).
--
-- Triggers rather than app calls: 17 routes write payments; one rule here
-- covers all of them, scripts and the HayLoft sync included.
--
-- ponytail: whole-registration payments (type 10, PayPal checkout) are not
-- counted toward entry fees; per-bird FeeLines allocation replaces this.

CREATE OR REPLACE FUNCTION sync_entry_fee_paid(inv_ids integer[]) RETURNS void
LANGUAGE sql AS $$
  WITH credit AS (
    SELECT "ID_EVENT_INVENTORY" AS inv, SUM("PAYMENT_VALUE") AS amt
    FROM "Payments"
    WHERE "ID_EVENT_INVENTORY" = ANY(inv_ids) AND status = 'PAID' AND "PAYMENT_TYPE" = 1
    GROUP BY 1
  ), items AS (
    SELECT e."ID_EVENT_INVENTORY_ITEM" AS id, e."ID_EVENT_INVENTORY" AS inv,
           SUM(e."ENTRY_FEE_VALUE") OVER (
             PARTITION BY e."ID_EVENT_INVENTORY"
             ORDER BY e."BIRD_NO" NULLS LAST, e."ID_EVENT_INVENTORY_ITEM"
           ) AS cum
    FROM "EventInventoryItem" e
    WHERE e."ID_EVENT_INVENTORY" = ANY(inv_ids)
      AND e."DELETED_AT" IS NULL
      AND e."ENTRY_FEE_VALUE" IS NOT NULL
  ), want AS (
    SELECT i.id, CASE WHEN i.cum <= COALESCE(c.amt, 0) + 0.005 THEN 1 ELSE 0 END::smallint AS paid
    FROM items i LEFT JOIN credit c ON c.inv = i.inv
  )
  UPDATE "EventInventoryItem" t
  SET "ENTRY_FEE_PAID" = want.paid
  FROM want
  WHERE t."ID_EVENT_INVENTORY_ITEM" = want.id
    AND COALESCE(t."ENTRY_FEE_PAID", 0) <> want.paid;
$$;

CREATE OR REPLACE FUNCTION trg_payments_entry_fee_paid() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM sync_entry_fee_paid(array_remove(ARRAY[
    CASE WHEN TG_OP <> 'INSERT' THEN OLD."ID_EVENT_INVENTORY" END,
    CASE WHEN TG_OP <> 'DELETE' THEN NEW."ID_EVENT_INVENTORY" END
  ], NULL));
  RETURN NULL;
END $$;

CREATE TRIGGER payments_entry_fee_paid
AFTER INSERT OR UPDATE OR DELETE ON "Payments"
FOR EACH ROW EXECUTE FUNCTION trg_payments_entry_fee_paid();

-- Items: statement-level, so posting entry fees on 5,000 birds runs the
-- allocation once per registration, not once per bird. The sync's own
-- update changes only ENTRY_FEE_PAID, so it finds nothing to redo.
CREATE OR REPLACE FUNCTION trg_items_entry_fee_paid() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE ids integer[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT array_agg(DISTINCT "ID_EVENT_INVENTORY") INTO ids FROM new_rows;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT array_agg(DISTINCT "ID_EVENT_INVENTORY") INTO ids FROM old_rows;
  ELSE
    SELECT array_agg(DISTINCT x) INTO ids FROM (
      SELECT n."ID_EVENT_INVENTORY" AS x FROM new_rows n JOIN old_rows o USING ("ID_EVENT_INVENTORY_ITEM")
      WHERE n."ENTRY_FEE_VALUE" IS DISTINCT FROM o."ENTRY_FEE_VALUE"
         OR n."BIRD_NO" IS DISTINCT FROM o."BIRD_NO"
         OR n."DELETED_AT" IS DISTINCT FROM o."DELETED_AT"
         OR n."ID_EVENT_INVENTORY" IS DISTINCT FROM o."ID_EVENT_INVENTORY"
      UNION
      SELECT o."ID_EVENT_INVENTORY" FROM new_rows n JOIN old_rows o USING ("ID_EVENT_INVENTORY_ITEM")
      WHERE n."ID_EVENT_INVENTORY" IS DISTINCT FROM o."ID_EVENT_INVENTORY"
    ) s WHERE x IS NOT NULL;
  END IF;
  IF ids IS NOT NULL THEN PERFORM sync_entry_fee_paid(ids); END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER items_entry_fee_paid_ins AFTER INSERT ON "EventInventoryItem"
REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION trg_items_entry_fee_paid();
CREATE TRIGGER items_entry_fee_paid_upd AFTER UPDATE ON "EventInventoryItem"
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION trg_items_entry_fee_paid();
CREATE TRIGGER items_entry_fee_paid_del AFTER DELETE ON "EventInventoryItem"
REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION trg_items_entry_fee_paid();
