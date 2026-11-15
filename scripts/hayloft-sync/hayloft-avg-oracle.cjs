// HayLoft's own average-speed ranking (RACE_AVG_SPEED_GET), as an answer key
// for the portal's port (lib/hayloft-avg-speed). For each event with races of
// distance, two selections: its hot spot races (types 6, 7, 8) counting only
// hot-spot-paid birds, and every race counting every bird; prizes calculated.
//
//   node scripts/hayloft-sync/hayloft-avg-oracle.cjs <copy.FDB> <out.json> [eventId ...]
//
// Writes scratch rows to TMP_ID on the copy; never run it on the live file.
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ISQL = process.env.ISQL || "C:/Program Files (x86)/Firebird/Firebird_2_0/bin/isql.exe";
const [fdb, out, ...ids] = process.argv.slice(2);
if (!fdb || !out) { console.error("usage: node hayloft-avg-oracle.cjs <copy.FDB> <out.json> [eventId ...]"); process.exit(2); }
function isql(sql) {
  const f = path.join(os.tmpdir(), `avg-oracle-${process.pid}.sql`);
  fs.writeFileSync(f, sql);
  try { return execFileSync(ISQL, ["-user", "SYSDBA", "-password", "masterkey", "-i", f, fdb], { encoding: "latin1", maxBuffer: 1 << 30 }); }
  finally { fs.unlinkSync(f); }
}
const list = (text, col) => text.split(/\r?\n/).map((l) => l.match(new RegExp(`^${col}\\s+(-?\\d+)`))).filter(Boolean).map((m) => Number(m[1]));
const COLS = ["ID_EVENT_INVENTORY_ITEM", "BIRD_POSITION", "RACE_COUNT", "TOTAL_FLIGHT_TIME", "TOTAL_FLIGHT_DISTANCE", "AVG_SPEED_IN_YARDS", "AVG_SPEED_IN_MILES", "HOT_SPOT_PRIZE_VALUE"];

const events = ids.length ? ids.map(Number) : list(isql("SET LIST ON;\nSELECT ID_EVENT FROM EVENTS ORDER BY ID_EVENT;\n"), "ID_EVENT");
const result = {};
for (const ev of events) {
  const sels = {
    hotspot: list(isql(`SET LIST ON;\nSELECT ID_RACE FROM RACE WHERE ID_EVENT = ${ev} AND ID_RACE_TYPE IN (6,7,8) AND COALESCE(DISTANCE,0) > 0;\n`), "ID_RACE"),
    all: list(isql(`SET LIST ON;\nSELECT ID_RACE FROM RACE WHERE ID_EVENT = ${ev} AND COALESCE(DISTANCE,0) > 0;\n`), "ID_RACE"),
  };
  result[ev] = {};
  for (const [name, races] of Object.entries(sels)) {
    if (!races.length) continue;
    const onlyHs = name === "hotspot" ? 1 : 0;
    const tag = `ORACLE_${ev}_${name}`;
    isql(
      `DELETE FROM TMP_ID WHERE TAG = '${tag}';\n` +
        races.map((r) => `INSERT INTO TMP_ID (ID, TAG) VALUES (${r}, '${tag}');`).join("\n") +
        `\nCOMMIT;\n`
    );
    let text;
    try {
      text = isql(`SET LIST ON;\nSELECT ${COLS.join(", ")} FROM RACE_AVG_SPEED_GET('${tag}', ${ev}, ${onlyHs}, 1);\n`);
    } catch (e) {
      // HayLoft itself fails here (NUMERIC(15,4) overflow once a bird's total distance is long).
      const msg = String(e.stderr || e.message).split(/\r?\n/).filter(Boolean)[1] || "failed";
      result[ev][name] = { races, onlyHotSpotPaid: !!onlyHs, error: msg };
      console.log(`event ${ev} ${name}: HayLoft error: ${msg}`);
      continue;
    } finally {
      isql(`DELETE FROM TMP_ID WHERE TAG = '${tag}';\nCOMMIT;\n`);
    }
    const rows = [];
    let cur = null;
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^([A-Z_]+)\s+(.*)$/);
      if (!m || !COLS.includes(m[1])) continue;
      if (m[1] === COLS[0]) { cur = {}; rows.push(cur); }
      const v = m[2].trim();
      cur[m[1]] = v === "<null>" ? null : Number(v);
    }
    result[ev][name] = { races, onlyHotSpotPaid: !!onlyHs, rows };
    console.log(`event ${ev} ${name}: ${races.length} races, ${rows.length} birds`);
  }
}
fs.writeFileSync(out, JSON.stringify(result));
console.log(`wrote ${out}`);
