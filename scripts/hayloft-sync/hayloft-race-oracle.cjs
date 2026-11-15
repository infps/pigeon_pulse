// HayLoft's own race recalculation, as an answer key for the portal's race engine.
//
// Runs HayLoft's stored procedure RACE_RECALC (positions, hot spot positions,
// prizes) for every final / hot spot race on a SCRATCH COPY of HAYLOFT.FDB —
// it rewrites results — and exports the recomputed RACE_ITEM_RESULT rows.
// reconcile-races.ts compares the portal's engine (lib/race-results) with them.
//
//   node scripts/hayloft-sync/hayloft-race-oracle.cjs <scratch-copy.FDB> <out.json> [raceId ...]
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ISQL = process.env.ISQL || "C:/Program Files (x86)/Firebird/Firebird_2_0/bin/isql.exe";
const [fdb, out, ...ids] = process.argv.slice(2);
if (!fdb || !out) {
  console.error("usage: node hayloft-race-oracle.cjs <scratch-copy.FDB> <out.json> [raceId ...]");
  process.exit(2);
}
function isql(sql) {
  const f = path.join(os.tmpdir(), `race-oracle-${process.pid}.sql`);
  fs.writeFileSync(f, sql);
  try {
    return execFileSync(ISQL, ["-user", "SYSDBA", "-password", "masterkey", "-i", f, fdb], { encoding: "latin1", maxBuffer: 1 << 30 });
  } finally {
    fs.unlinkSync(f);
  }
}
const ints = (text, col) =>
  text.split(/\r?\n/).map((l) => l.match(new RegExp(`^${col}\\s+(-?\\d+)`))).filter(Boolean).map((m) => Number(m[1]));

const races = ids.length
  ? ids.map(Number)
  : ints(isql("SET LIST ON;\nSELECT ID_RACE FROM RACE WHERE ID_RACE_TYPE IN (5,6,7,8) ORDER BY ID_RACE;\n"), "ID_RACE");

const result = {};
for (const race of races) {
  isql(`EXECUTE PROCEDURE RACE_RECALC(${race});\nCOMMIT;\n`);
  const text = isql(
    `SET LIST ON;\nSELECT rir.ID_RACE_ITEM, rir.BIRD_POSITION, rir.BIRD_POSITION_HOT_SPOT, rir.PRIZE_VALUE\n` +
      `FROM RACE_ITEM_RESULT rir JOIN RACE_ITEM ri ON ri.ID_RACE_ITEM = rir.ID_RACE_ITEM WHERE ri.ID_RACE = ${race};\n`
  );
  const rows = [];
  let cur = null;
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^(ID_RACE_ITEM|BIRD_POSITION_HOT_SPOT|BIRD_POSITION|PRIZE_VALUE)\s+(.*)$/);
    if (!m) continue;
    if (m[1] === "ID_RACE_ITEM") { cur = {}; rows.push(cur); }
    const v = m[2].trim();
    cur[m[1]] = v === "<null>" ? null : Number(v);
  }
  result[race] = rows;
  console.log(`race ${race}: ${rows.length} results`);
}
fs.writeFileSync(out, JSON.stringify(result));
console.log(`wrote ${out}`);
