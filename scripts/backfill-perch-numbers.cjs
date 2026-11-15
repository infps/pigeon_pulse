// Give every bird of a portal-made registration its perch number (BIRD_NO),
// as HayLoft numbers every bird it registers. Registration used to leave it
// empty; it now assigns the next perch (lib/bird-moves nextPerch).
//
// Only registrations in which NO live bird has a number are touched: that is a
// portal registration. HayLoft's own few unnumbered birds sit in registrations
// whose other birds are numbered, and are left exactly as HayLoft has them.
// Numbers follow entry order. Perch fees are not changed.
//
//   node scripts/backfill-perch-numbers.cjs          dry run
//   node scripts/backfill-perch-numbers.cjs --apply  commit
require("dotenv").config({ path: require("path").join(__dirname, "../.env"), quiet: true });
const { Client } = require("pg");

(async () => {
  const apply = process.argv.includes("--apply");
  const c = new Client({ connectionString: process.env.DIRECT_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log(`${apply ? "APPLY" : "DRY RUN"} on ${new URL(process.env.DIRECT_URL).hostname}`);
  const LIVE = `"ID_REPLACED_ITEM" IS NULL AND "DELETED_AT" IS NULL`;
  const regs = (await c.query(`
    SELECT "ID_EVENT_INVENTORY" id, COUNT(*)::int n
    FROM "EventInventoryItem"
    WHERE ${LIVE} AND "ID_EVENT_INVENTORY" IS NOT NULL
    GROUP BY 1
    HAVING COUNT("BIRD_NO") = 0`)).rows;
  const birds = regs.reduce((s, r) => s + r.n, 0);
  console.log(`registrations with no numbered bird: ${regs.length}, birds to number: ${birds}`);
  await c.query("BEGIN");
  try {
    let done = 0;
    for (const r of regs) {
      const res = await c.query(`
        UPDATE "EventInventoryItem" t SET "BIRD_NO" = x.rn
        FROM (SELECT "ID_EVENT_INVENTORY_ITEM" id, ROW_NUMBER() OVER (ORDER BY "ID_EVENT_INVENTORY_ITEM") rn
              FROM "EventInventoryItem" WHERE "ID_EVENT_INVENTORY" = $1 AND ${LIVE}) x
        WHERE t."ID_EVENT_INVENTORY_ITEM" = x.id`, [r.id]);
      done += res.rowCount;
    }
    const left = (await c.query(`SELECT COUNT(*)::int n FROM "EventInventoryItem" i WHERE ${LIVE} AND "BIRD_NO" IS NULL
      AND "ID_EVENT_INVENTORY" = ANY($1)`, [regs.map((r) => r.id)])).rows[0].n;
    console.log(`numbered ${done} birds; still unnumbered in those registrations: ${left}`);
    if (done !== birds || left !== 0) throw new Error("check failed");
    await c.query(apply ? "COMMIT" : "ROLLBACK");
    console.log(apply ? "Committed." : "Rolled back, nothing changed.");
  } catch (e) {
    await c.query("ROLLBACK");
    console.error("ROLLED BACK:", e.message);
    process.exitCode = 1;
  }
  await c.end();
})();
