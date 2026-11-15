// Value transforms that reproduce the original HayLoft -> Neon import (Nov 2025),
// so synced rows look exactly like the rows already there:
//   - DATE / TIMESTAMP: HayLoft stores local America/Los_Angeles time; Neon holds
//     the same instant in UTC (timestamp without time zone).
//   - TIME (race sunrise/sunset): stored as 1970-01-01 shifted by -5:30 (the
//     importing machine ran in IST). Odd, but every existing race has it.
//   - Delphi's zero date 1899-12-30 means "no date" -> NULL.
//   - COUNTRY "USA" -> "US" (the portal's country codes).
const fs = require("fs");

let colTypes = {};
function loadCols(file) {
  colTypes = {};
  for (const l of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const [t, c, ty] = l.split("|");
    if (c) (colTypes[t] ??= {})[c] = +ty;
  }
}

const laFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles", hourCycle: "h23",
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
});
// Minutes Los Angeles is behind UTC at that wall-clock time (PDT 420, PST 480).
function laOffsetMin(y, mo, d, h, mi) {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  for (const off of [420, 480]) {
    const p = Object.fromEntries(laFmt.formatToParts(new Date(guess + off * 60000)).map((x) => [x.type, x.value]));
    if (+p.year === y && +p.month === mo && +p.day === d && +p.hour === h && +p.minute === mi) return off;
  }
  return 480; // the skipped hour at spring-forward
}
const pad = (n, w = 2) => String(n).padStart(w, "0");
function fmt(t) {
  let s = `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())} ${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:${pad(t.getUTCSeconds())}`;
  if (t.getUTCMilliseconds()) s += "." + pad(t.getUTCMilliseconds(), 3).replace(/0+$/, "");
  return s;
}

function laToUtc(s) {
  const m = /^(\d{4})-(\d\d)-(\d\d)(?: (\d\d):(\d\d):(\d\d)(?:\.(\d+))?)?$/.exec(s);
  if (!m) return s;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  if (y < 1900) return null;
  const [h, mi, se] = [+(m[4] || 0), +(m[5] || 0), +(m[6] || 0)];
  const ms = m[7] ? Math.round(Number("0." + m[7]) * 1000) : 0;
  return fmt(new Date(Date.UTC(y, mo - 1, d, h, mi, se, ms) + laOffsetMin(y, mo, d, h, mi) * 60000));
}

function timeToPg(s) {
  const m = /^(\d\d):(\d\d):(\d\d)/.exec(s);
  if (!m) return s;
  return fmt(new Date(Date.UTC(1970, 0, 1, +m[1], +m[2], +m[3]) - 330 * 60000));
}

function xf(table, col, v) {
  if (v === null || v === undefined) return null;
  const ty = colTypes[table]?.[col];
  if (ty === 12 || ty === 35) return laToUtc(v);
  if (ty === 13) return timeToPg(v);
  if (typeof v === "string") {
    v = v.replace(/\r/g, "");
    if (col === "COUNTRY" && v === "USA") return "US";
  }
  return v;
}

module.exports = { loadCols, xf, laToUtc, timeToPg };
