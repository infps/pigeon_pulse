-- Backfill: imported payment history is money already received.
--
-- Every row below ID 7585 came from the legacy import and was left on the column
-- default (PENDING). Rows from 7585 up were created in the app and keep their
-- status, so unpaid orders, pay-cash-later bet stakes and cash promises stay
-- PENDING. The boundary is specific to this database's import.

UPDATE "Payments" SET "status" = 'PAID'
WHERE "ID_PAYMENT" < 7585 AND "status" = 'PENDING';
