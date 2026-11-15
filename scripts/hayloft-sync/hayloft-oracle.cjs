// HayLoft's own figures for every registration, straight from its stored
// procedure EVENT_INVENTORY_GET (the procedure behind HayLoft's registration
// list and Details screen, including each breeder's BALANCE_VALUE).
// The answer key that reconcile-accounts.ts checks the portal against.
//
//   node scripts/hayloft-sync/hayloft-oracle.cjs <copy.FDB> <out.json> [eventId ...]
//
// Run against a COPY of HAYLOFT.FDB: the procedure writes scratch rows (TMP_BETS).
// Needs the local Firebird 2.0 server (isql, SYSDBA).
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ISQL = process.env.ISQL || "C:/Program Files (x86)/Firebird/Firebird_2_0/bin/isql.exe";
const [fdb, out, ...ids] = process.argv.slice(2);
if (!fdb || !out) {
  console.error("usage: node hayloft-oracle.cjs <copy.FDB> <out.json> [eventId ...]");
  process.exit(2);
}

function isql(sql) {
  const f = path.join(os.tmpdir(), `oracle-${process.pid}.sql`);
  fs.writeFileSync(f, sql);
  try {
    return execFileSync(ISQL, ["-user", "SYSDBA", "-password", "masterkey", "-i", f, fdb], {
      encoding: "latin1",
      maxBuffer: 1 << 30,
    });
  } finally {
    fs.unlinkSync(f);
  }
}

// Numeric and date columns only; names and notes are not needed and can hold newlines.
const COLS = [
  "ID_EVENT_INVENTORY", "ID_BREEDER", "SIGN_IN_DATE", "IS_WAITING", "RESERVED_BIRDS", "IN_LOFT_BIRDS",
  "LOST_BIRDS", "REPLACED_BIRDS", "PERCH_FEE_VALUE", "ENTRY_FEE_VALUE", "BETS_VALUE", "HOT_SPOT_BIRDS",
  "HOT_SPOT_VALUE", "ENTRY_REFUND", "BETS_REFUND", "HOT_SPOT_REFUND", "PERCH_FEE_PAY_VALUE",
  "ENTRY_FEE_PAY_VALUE", "BETS_PAY_VALUE", "HOT_SPOT_PAY_VALUE", "ENTRY_REFUND_PAY_VALUE",
  "BETS_REFUND_PAY_VALUE", "HOT_SPOT_REFUND_PAY_VALUE", "ENTRY_BIRDS", "TRANSFER_DUE",
  "TRANSFER_DUE_PAY_VALUE", "CAPITAL_PRIZE", "HOT_SPOT_1_PRIZE", "HOT_SPOT_2_PRIZE", "HOT_SPOT_3_PRIZE",
  "AVG_SPEED_WINNER_PRIZE", "BETS_PRIZE", "WINNER_PAYOUT_VALUE", "WINNER_PAYOUT_PAY_VALUE",
  "TOTAL_PAYMENT_VALUE", "BALANCE_VALUE",
];

const events = ids.length
  ? ids.map(Number)
  : isql("SET LIST ON;\nSELECT ID_EVENT FROM EVENTS ORDER BY ID_EVENT;\n")
      .split(/\r?\n/)
      .map((l) => l.match(/^ID_EVENT\s+(\d+)/))
      .filter(Boolean)
      .map((m) => Number(m[1]));

const result = {};
for (const ev of events) {
  const text = isql(`SET LIST ON;\nSELECT ${COLS.join(", ")} FROM EVENT_INVENTORY_GET(${ev}, NULL);\nCOMMIT;\n`);
  const rows = [];
  let cur = null;
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s+(.*)$/);
    if (!m || !COLS.includes(m[1])) continue;
    if (m[1] === COLS[0]) { cur = {}; rows.push(cur); }
    const v = m[2].trim();
    cur[m[1]] = v === "<null>" ? null : m[1] === "SIGN_IN_DATE" ? v : Number(v);
  }
  result[ev] = rows;
  console.log(`event ${ev}: ${rows.length} registrations`);
}
fs.writeFileSync(out, JSON.stringify(result));
console.log(`wrote ${out}`);
