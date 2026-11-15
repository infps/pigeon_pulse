// Brings payments written with the portal's old payment-type codes onto the
// one table every reader now uses: HayLoft's (src/lib/payment-types.ts).
//
// Old portal codes: 0 PERCH_FEE, 1 BIRD_FEE, 2 RACES_FEE, 3 PAYOUTS, 4 OTHER,
// and NULL for a registration's single payment. HayLoft's: 0 perch fee,
// 1 entry fee, 2 bets, 3 hot spot, 4 entry refund, 5 bets refund, 6 hot spot
// refund, 7 transfer due, 8 winner payout; the portal adds 9 other, 10 registration.
//
// Each rule picks out portal rows from the data alone, so it is safe on any DB:
// HayLoft never leaves the type empty, and its refunds/payouts (4, 6, 8) are
// always stored negative, so a POSITIVE type-4 row can only be the portal's OTHER.
//
//   node scripts/hayloft-sync/normalize-payment-types.cjs          dry run
//   node scripts/hayloft-sync/normalize-payment-types.cjs --apply  commit
require("dotenv").config({ path: require("path").join(__dirname, "../../.env"), quiet: true });
const { Client } = require("pg");

const RULES = [
  {
    name: "portal OTHER (money in, positive) → 9 Other",
    where: `"PAYMENT_TYPE" = 4 AND "PAYMENT_VALUE" > 0`,
    set: `"PAYMENT_TYPE" = 9`,
  },
  {
    name: "untyped registration payment → 10 Registration",
    where: `"PAYMENT_TYPE" IS NULL`,
    set: `"PAYMENT_TYPE" = 10`,
  },
  {
    name: "hot spot gate payment written as 2 → 3 Hot spot",
    where: `"PAYMENT_TYPE" = 2 AND "HOTSPOT_GATE" IS NOT NULL`,
    set: `"PAYMENT_TYPE" = 3`,
  },
  {
    name: "portal bet refund to a bettor (3) → 5 Bets refund, negative",
    where: `"PAYMENT_TYPE" = 3 AND "BETTOR_ID" IS NOT NULL AND "PAYMENT_DESC" ILIKE 'Bet refund%'`,
    set: `"PAYMENT_TYPE" = 5, "PAYMENT_VALUE" = -ABS("PAYMENT_VALUE")`,
  },
  {
    name: "portal winner payout to a bettor (3) → 8 Winner payout, negative",
    where: `"PAYMENT_TYPE" = 3 AND "BETTOR_ID" IS NOT NULL AND "PAYMENT_DESC" NOT ILIKE 'Bet refund%'`,
    set: `"PAYMENT_TYPE" = 8, "PAYMENT_VALUE" = -ABS("PAYMENT_VALUE")`,
  },
];

(async () => {
  const apply = process.argv.includes("--apply");
  const c = new Client({ connectionString: process.env.DIRECT_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log(`${apply ? "APPLY" : "DRY RUN"} on ${new URL(process.env.DIRECT_URL).hostname}`);
  const totals = async () =>
    (await c.query(`SELECT COUNT(*)::int n, ROUND(SUM("PAYMENT_VALUE")::numeric, 2)::text v FROM "Payments"`)).rows[0];
  await c.query("BEGIN");
  try {
    const before = await totals();
    for (const r of RULES) {
      const rows = (await c.query(`SELECT "ID_PAYMENT" id, "PAYMENT_VALUE" v FROM "Payments" WHERE ${r.where} ORDER BY 1`)).rows;
      const res = await c.query(`UPDATE "Payments" SET ${r.set} WHERE ${r.where}`);
      console.log(`- ${r.name}: ${res.rowCount}${rows.length ? "  ids " + rows.map((x) => x.id).join(",") : ""}`);
    }
    const after = await totals();
    console.log(`payments ${before.n} → ${after.n}, sum ${before.v} → ${after.v}`);
    // HayLoft's own invariant must hold afterwards: refunds and payouts are never positive.
    const bad = (await c.query(`SELECT COUNT(*)::int n FROM "Payments" WHERE "PAYMENT_TYPE" IN (4,5,6,8) AND "PAYMENT_VALUE" > 0`)).rows[0].n;
    const untyped = (await c.query(`SELECT COUNT(*)::int n FROM "Payments" WHERE "PAYMENT_TYPE" IS NULL`)).rows[0].n;
    console.log(`check: positive refunds/payouts ${bad}, untyped ${untyped}`);
    if (bad || untyped) throw new Error("check failed");
    await c.query(apply ? "COMMIT" : "ROLLBACK");
    console.log(apply ? "Committed." : "Rolled back, nothing changed.");
  } catch (e) {
    await c.query("ROLLBACK");
    console.error("ROLLED BACK:", e.message);
    process.exitCode = 1;
  }
  await c.end();
})();
