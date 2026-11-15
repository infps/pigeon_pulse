// Payments imported from HayLoft have no ID_BREEDER (HayLoft links a payment only
// through its registration), but the breeder-facing payment screens look payments up
// by Payments.ID_BREEDER, so imported history showed as empty / $0.
// Copies the registration's breeder onto every payment that has none.
//   node scripts/hayloft-sync/backfill-payment-breeder.cjs          dry run
//   node scripts/hayloft-sync/backfill-payment-breeder.cjs --apply  commit
require("dotenv").config({ path: require("path").join(__dirname, "../../.env"), quiet: true });
const { Client } = require("pg");

(async () => {
  const apply = process.argv.includes("--apply");
  const c = new Client({ connectionString: process.env.DIRECT_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log(`${apply ? "APPLY" : "DRY RUN"} on ${new URL(process.env.DIRECT_URL).hostname}`);
  await c.query("BEGIN");
  const before = await c.query(`select count(*) n, coalesce(sum("PAYMENT_VALUE"),0) v from "Payments" where "ID_BREEDER" is null`);
  const r = await c.query(`
    update "Payments" p set "ID_BREEDER" = ei."ID_BREEDER"
    from "EventInventory" ei
    where ei."ID_EVENT_INVENTORY" = p."ID_EVENT_INVENTORY"
      and p."ID_BREEDER" is null and ei."ID_BREEDER" is not null`);
  const after = await c.query(`select count(*) n, coalesce(sum("PAYMENT_VALUE"),0) v from "Payments" where "ID_BREEDER" is null`);
  console.log(`payments without breeder: ${before.rows[0].n} ($${(+before.rows[0].v).toFixed(2)})`);
  console.log(`updated: ${r.rowCount}`);
  console.log(`still without breeder (no registration/breeder): ${after.rows[0].n} ($${(+after.rows[0].v).toFixed(2)})`);
  await c.query(apply ? "COMMIT" : "ROLLBACK");
  console.log(apply ? "Committed." : "Rolled back, nothing changed.");
  await c.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
