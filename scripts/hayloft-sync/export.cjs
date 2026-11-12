// Export the HayLoft Firebird 2.0 business tables to JSON. Read-only (SELECT only).
//
//   node scripts/hayloft-sync/export.cjs <path-to-COPY-of-HAYLOFT.FDB> <dump-dir>
//
// Point it at a copy of the .FDB, not the live file. The node Firebird drivers
// hang against the 2.0 server, so this drives isql in list mode and parses that.
// The dump holds personal data (SSNs, addresses): keep it out of the repo.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ISQL = process.env.ISQL || "C:/Program Files (x86)/Firebird/Firebird_2_0/bin/isql.exe";
const [fdb, outDir] = process.argv.slice(2);
if (!fdb || !outDir) {
  console.error("usage: export.cjs <fdb> <dump-dir>");
  process.exit(1);
}
const DB = "localhost:" + path.resolve(fdb);
fs.mkdirSync(outDir, { recursive: true });

const TABLES = [
  "AVG_WINNER_PRIZES", "BASKET", "BETTING_SCHEME", "BIRDS", "BREEDERS", "EVENTS",
  "EVENT_INVENTORY", "EVENT_INVENTORY_ITEM", "EVENT_RACE_NUMBER", "FEE_SCHEME",
  "LOST_HISTORY", "PARTNERS", "PAYMENTS", "PERCH_FEE_ITEM", "PRIZE_SCHEME",
  "PRIZE_SCHEME_ITEM", "PRIZE_VALUE", "RACE", "RACE_IGNORE_BIRD", "RACE_ITEM",
  "RACE_ITEM_RESULT", "RACE_ITEM_SCAN", "RACE_NUMBER_GROUP", "RACE_PHANTOM_BIRD",
  "RACE_TYPE", "STANDARD_SHOW_PERCENTAGE",
];

function isql(sqlFile, outFile) {
  if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
  execFileSync(ISQL, ["-u", "SYSDBA", "-p", process.env.FB_PASSWORD || "masterkey", "-i", sqlFile, "-o", outFile, DB], {
    stdio: "inherit",
  });
}

// 1. Column metadata (name, type, scale) in table order.
const colsSql = path.join(outDir, "_cols.sql");
fs.writeFileSync(
  colsSql,
  `SET HEADING OFF;
SELECT TRIM(rf.RDB$RELATION_NAME)||'|'||TRIM(rf.RDB$FIELD_NAME)||'|'||f.RDB$FIELD_TYPE||'|'||COALESCE(f.RDB$FIELD_SUB_TYPE,0)||'|'||COALESCE(f.RDB$FIELD_LENGTH,0)||'|'||COALESCE(f.RDB$FIELD_SCALE,0)
FROM RDB$RELATION_FIELDS rf JOIN RDB$FIELDS f ON f.RDB$FIELD_NAME=rf.RDB$FIELD_SOURCE JOIN RDB$RELATIONS r ON r.RDB$RELATION_NAME=rf.RDB$RELATION_NAME
WHERE r.RDB$SYSTEM_FLAG=0 AND r.RDB$VIEW_BLR IS NULL ORDER BY rf.RDB$RELATION_NAME, rf.RDB$FIELD_POSITION;
`,
);
isql(colsSql, path.join(outDir, "_cols.raw"));
const colsTxt = fs
  .readFileSync(path.join(outDir, "_cols.raw"), "latin1")
  .split(/\r?\n/)
  .map((l) => l.replace(/\s+/g, ""))
  .filter((l) => l.includes("|"))
  .join("\n");
fs.writeFileSync(path.join(outDir, "cols.txt"), colsTxt);
const cols = {};
for (const l of colsTxt.split("\n")) {
  const [t, c, ty, , , sc] = l.split("|");
  (cols[t] ??= []).push({ c, ty: +ty, sc: +sc });
}

// 2. Each table in list mode, then parse.
for (const t of TABLES) {
  const sql = path.join(outDir, `_${t}.sql`);
  const txt = path.join(outDir, `_${t}.txt`);
  fs.writeFileSync(sql, `SET LIST ON;\nSELECT * FROM ${t};\n`);
  isql(sql, txt);
  const rows = parse(t, txt);
  fs.writeFileSync(path.join(outDir, t + ".json"), JSON.stringify(rows));
  fs.unlinkSync(txt);
  fs.unlinkSync(sql);
  console.log(t.padEnd(26), rows.length);
}

// List mode prints "COLUMN<pad to 32>value" per line, one blank line between rows.
// Values can span lines (memo text), so a record starts only at the table's first
// column and every other line is matched against the next expected column.
function parse(t, file) {
  const order = cols[t].map((x) => x.c);
  const types = Object.fromEntries(cols[t].map((x) => [x.c, x]));
  const rows = [];
  let cur = null, last = null, expect = 0;
  for (const line of fs.readFileSync(file, "latin1").split(/\r?\n/)) {
    const name = order[expect];
    const isCol = name && line.slice(0, 32).trimEnd() === name && (line.length <= 32 || line[31] === " ");
    if (isCol) {
      if (expect === 0) {
        if (cur) rows.push(cur);
        cur = {};
      }
      const v = line.length > 32 ? line.slice(32) : "";
      cur[name] = v === "<null>" ? null : conv(v, types[name]);
      last = name;
      expect = (expect + 1) % order.length;
    } else if (cur && last && expect !== 0) {
      cur[last] = (cur[last] ?? "") + "\n" + line; // continuation of a multi-line value
    } else if (cur && last && line !== "") {
      cur[last] = (cur[last] ?? "") + "\n" + line; // continuation of the last column
    }
  }
  if (cur) rows.push(cur);
  for (const r of rows) for (const k in r) if (typeof r[k] === "string") r[k] = r[k].replace(/\n+$/, "");
  return rows;
}

function conv(v, t) {
  // 7 smallint, 8 int, 16 bigint, 10 float, 27 double, 14 char, 37 varchar, 12 date, 13 time, 35 timestamp
  if ([7, 8, 16, 10, 27].includes(t.ty)) return Number(v);
  if (t.ty === 14) return v.trimEnd();
  return v;
}
