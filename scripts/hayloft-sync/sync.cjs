// Sync a newer HayLoft export into the Neon DB, on top of the original Nov 2025 import.
//
//   node scripts/hayloft-sync/sync.cjs <dump-dir>            # dry run: runs everything in a
//                                                            # transaction, prints, ROLLBACK
//   node scripts/hayloft-sync/sync.cjs <dump-dir> --apply    # same, then COMMIT
//
// Uses DIRECT_URL (falls back to DATABASE_URL) from .env.
//
// Rules (agreed 2026-11-12):
// - New HayLoft rows are inserted. HayLoft ids are kept when free; when the portal has
//   already used that id for its own row, the HayLoft row gets a fresh id and every
//   reference to it is remapped. Portal rows are never modified by a collision.
// - Rows from the original import ("legacy": id <= the import cutoff, or CREATOR_ID = 1
//   for schemes) that changed in HayLoft: HayLoft wins on race and money fields
//   (WINS below); everywhere else the portal value is kept, and HayLoft only fills
//   in values that are blank in Neon.
// - Legacy rows missing from Neon were deleted in the portal: not re-inserted.
//   Legacy rows missing from HayLoft are reported, never deleted.
// - HayLoft event 21 "TEST RACE" is skipped with everything hanging off it.
// - HayLoft event 20 (AGN 2026) is a new Event with its own new Season.
require("dotenv").config({ path: require("path").join(__dirname, "../../.env"), quiet: true });
const fs = require("fs");
const path = require("path");
const pg = require("pg");
const { loadCols, xf } = require("./xform.cjs");

for (const oid of [1114, 1184, 1082, 1083]) pg.types.setTypeParser(oid, (s) => s); // timestamps as raw text

const DUMP = process.argv[2];
const APPLY = process.argv.includes("--apply");
if (!DUMP) {
  console.error("usage: sync.cjs <dump-dir> [--apply]");
  process.exit(1);
}
loadCols(path.join(DUMP, "cols.txt"));
const FB = (t) => JSON.parse(fs.readFileSync(path.join(DUMP, t + ".json"), "utf8"));

const EXCLUDED_EVENTS = new Set([21]);
// Max HayLoft id present at the original import, per table. Above this, an id that
// exists in Neon belongs to a row the portal created.
const CUTOFF = {
  BREEDERS: 1408, BIRDS: 16329, EVENTS: 19, EVENT_INVENTORY: 3420, EVENT_INVENTORY_ITEM: 12092,
  PAYMENTS: 7582, RACE: 834, RACE_ITEM: 390373, RACE_IGNORE_BIRD: 619, LOST_HISTORY: 14686,
  RACE_PHANTOM_BIRD: 38942, PRIZE_VALUE: 858,
};
// Columns where HayLoft overwrites a legacy row.
const WINS = {
  BIRDS: ["IS_LOST", "LOST_DATE", "LOST_ID_RACE", "IS_RACE_VERIFIED", "IS_ACTIVE"],
  EVENT_INVENTORY: ["RESERVED_BIRDS", "IS_WAITING", "WAITING_DATE", "SIGN_IN_DATE"],
  EVENT_INVENTORY_ITEM: "ALL",
  PAYMENTS: "ALL",
  RACE: "ALL_BUT:IS_CLOSED",
  RACE_ITEM: "ALL",
  RACE_ITEM_RESULT: "ALL",
  RACE_IGNORE_BIRD: "ALL",
  LOST_HISTORY: "ALL",
  RACE_PHANTOM_BIRD: "ALL",
  PRIZE_VALUE: "ALL",
  AVG_WINNER_PRIZES: "ALL",
};
const wins = (t, col) => {
  const w = WINS[t];
  if (!w) return false;
  if (w === "ALL") return true;
  if (typeof w === "string" && w.startsWith("ALL_BUT:")) return !w.slice(8).split(",").includes(col);
  return w.includes(col);
};

// Empty, or only a HayLoft input mask like "(   )   -    ".
const blank = (v) => v === null || v === undefined || (typeof v === "string" && /^[\s\-()\/.]*$/.test(v));
function norm(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number") return Math.round(v * 1e6) / 1e6;
  let s = String(v);
  if (/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d(\.\d+)?$/.test(s)) return s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  if (/^-?\d+(\.\d+)?$/.test(s.trim())) return Math.round(Number(s) * 1e6) / 1e6;
  return s.replace(/\r/g, "").trimEnd();
}

const report = [];
const log = (...a) => {
  const s = a.join(" ");
  report.push(s);
  console.log(s);
};

(async () => {
  const c = new pg.Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const q = (sql, p) => c.query(sql, p);
  const host = new URL(process.env.DIRECT_URL || process.env.DATABASE_URL).host;
  log(`# HayLoft -> Neon sync (${APPLY ? "APPLY" : "DRY RUN"}) on ${host}`);

  // ---------------------------------------------------------------- load Neon state
  const neon = {};
  async function loadNeon(pgT, pk) {
    const rows = (await q(`SELECT * FROM "${pgT}"`)).rows;
    neon[pgT] = new Map(rows.map((r) => [Array.isArray(pk) ? pk.map((k) => r[k]).join(":") : r[pk], r]));
    return neon[pgT];
  }
  const seasons = (await q(`SELECT * FROM "Seasons"`)).rows;

  // ---------------------------------------------------------------- id maps
  const M = {}; // FB table -> Map(fbId -> pgId)
  const NEXT = {}; // FB table -> next free id for remapped rows
  const plan = {}; // FB table -> { ins: [], upd: [], stats }
  const ref = (t, id) => (id === null || id === undefined ? null : M[t]?.get(id) ?? undefined);

  // Classify FB rows of a single-int-PK table into match / collision / new / deleted.
  function classify(fbT, pgT, pk, rows, isLegacy) {
    const N = neon[pgT];
    const m = (M[fbT] = new Map());
    const st = { match: 0, keep: 0, remap: 0, deletedInPortal: 0, excluded: 0 };
    let maxId = 0;
    for (const r of N.keys()) maxId = Math.max(maxId, r);
    for (const r of rows) maxId = Math.max(maxId, r[pk]);
    NEXT[fbT] = maxId + 1;
    const out = [];
    for (const r of rows) {
      const id = r[pk];
      if (r.__skip) { st.excluded++; continue; }
      const n = N.get(id);
      if (n && isLegacy(id, n)) { m.set(id, id); st.match++; out.push({ r, kind: "match", n }); }
      else if (n) { m.set(id, NEXT[fbT]++); st.remap++; out.push({ r, kind: "new" }); }
      else if (id <= (CUTOFF[fbT] ?? -1)) { st.deletedInPortal++; }
      else { m.set(id, id); st.keep++; out.push({ r, kind: "new" }); }
    }
    plan[fbT] = { pgT, pk, ins: [], upd: [], st, items: out, fills: {}, winsCount: {}, kept: {}, droppedRef: {} };
    return out;
  }

  // Build PG values for one FB row. fk: {FBCOL: FBTable | fn}. Returns null if a
  // required reference is unresolved.
  function build(fbT, r, pgCols, fk, rename = {}, required = []) {
    const o = {};
    const p = plan[fbT];
    for (const col of Object.keys(r)) {
      if (col.startsWith("__")) continue;
      const pc = rename[col] || col;
      if (!pgCols.has(pc)) continue;
      let v = xf(fbT, col, r[col]);
      if (fk[col] && v !== null) {
        const mapped = typeof fk[col] === "function" ? fk[col](v, r) : ref(fk[col], v);
        if (mapped === undefined) {
          if (required.includes(col)) return null;
          p.droppedRef[col] = (p.droppedRef[col] || 0) + 1;
          v = null;
        } else v = mapped;
      }
      o[pc] = v;
    }
    return o;
  }

  function diffUpdate(fbT, id, built, n, pkCols) {
    const p = plan[fbT];
    const set = {};
    for (const [col, v] of Object.entries(built)) {
      if (pkCols.includes(col)) continue;
      const fbCol = Object.entries(p.rename || {}).find(([, pc]) => pc === col)?.[0] || col;
      if (norm(v) === norm(n[col])) continue;
      if (wins(fbT, fbCol)) { set[col] = v; p.winsCount[col] = (p.winsCount[col] || 0) + 1; }
      else if (blank(n[col]) && !blank(v)) { set[col] = v; p.fills[col] = (p.fills[col] || 0) + 1; }
      else p.kept[col] = (p.kept[col] || 0) + 1;
    }
    if (Object.keys(set).length) p.upd.push({ id, set });
  }

  const pgColsOf = async (pgT) =>
    new Set((await q(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`, [pgT])).rows.map((r) => r.column_name));

  // Standard single-PK table handler.
  async function table(fbT, pgT, pk, opts = {}) {
    const { fk = {}, rename = {}, required = [], isLegacy = (id) => id <= CUTOFF[fbT], extra = () => ({}), rows = FB(fbT), skipUpdate = () => false } = opts;
    if (!neon[pgT]) await loadNeon(pgT, pk);
    const cols = await pgColsOf(pgT);
    const items = classify(fbT, pgT, pk, rows, isLegacy);
    const p = plan[fbT];
    p.rename = rename;
    p.fk = fk;
    for (const it of items) it.__cols = cols;
    p.finish = () => {
      for (const it of items) {
        const b = build(fbT, it.r, cols, fk, rename, required);
        if (!b) { p.st.unresolved = (p.st.unresolved || 0) + 1; M[fbT].delete(it.r[pk]); continue; }
        b[pk] = M[fbT].get(it.r[pk]);
        if (it.kind === "new") p.ins.push({ ...b, ...extra(it.r, b) });
        else if (!skipUpdate(it.n)) diffUpdate(fbT, b[pk], b, it.n, [pk]);
      }
    };
    return p;
  }

  // ================================================================ exclusions
  const fbEvents = FB("EVENTS");
  const fbInv = FB("EVENT_INVENTORY");
  const fbItems = FB("EVENT_INVENTORY_ITEM");
  const fbRaces = FB("RACE");
  const exclInv = new Set(fbInv.filter((r) => EXCLUDED_EVENTS.has(r.ID_EVENT)).map((r) => r.ID_EVENT_INVENTORY));
  const exclItems = new Set(fbItems.filter((r) => exclInv.has(r.ID_EVENT_INVENTORY)).map((r) => r.ID_EVENT_INVENTORY_ITEM));
  const exclRaces = new Set(fbRaces.filter((r) => EXCLUDED_EVENTS.has(r.ID_EVENT)).map((r) => r.ID_RACE));
  const birdUse = new Map();
  for (const it of fbItems) {
    const u = birdUse.get(it.ID_BIRD) || { keep: 0, excl: 0 };
    exclItems.has(it.ID_EVENT_INVENTORY_ITEM) ? u.excl++ : u.keep++;
    birdUse.set(it.ID_BIRD, u);
  }
  const breederUse = new Map();
  for (const r of fbInv) {
    const u = breederUse.get(r.ID_BREEDER) || { keep: 0, excl: 0 };
    exclInv.has(r.ID_EVENT_INVENTORY) ? u.excl++ : u.keep++;
    breederUse.set(r.ID_BREEDER, u);
  }
  for (const r of FB("PARTNERS")) {
    const u = breederUse.get(r.ID_BREEDER) || { keep: 0, excl: 0 };
    exclInv.has(r.ID_EVENT_INVENTORY) ? u.excl++ : u.keep++;
    breederUse.set(r.ID_BREEDER, u);
  }
  const onlyExcluded = (u) => u && u.excl > 0 && u.keep === 0;

  // ================================================================ schemes (legacy = CREATOR_ID 1)
  const legacyByCreator = (id, n) => n.CREATOR_ID === 1;
  const usedOnlyByExcluded = (col, id) =>
    fbEvents.some((e) => EXCLUDED_EVENTS.has(e.ID_EVENT) && e[col] === id) &&
    !fbEvents.some((e) => !EXCLUDED_EVENTS.has(e.ID_EVENT) && e[col] === id);
  const prizeCols = ["ID_FINAL_PRIZE_SCHEME", "ID_HOT_SPOT1_PRIZE_SCHEME", "ID_HOT_SPOT2_PRIZE_SCHEME", "ID_HOT_SPOT3_PRIZE_SCHEME", "ID_HOT_SPOT_AVG_PRIZE_SCHEME"];

  const schemeTables = [
    ["FEE_SCHEME", "FeeScheme", "ID_FEE_SCHEME", (r) => usedOnlyByExcluded("ID_FEE_SCHEME", r.ID_FEE_SCHEME)],
    ["BETTING_SCHEME", "BettingScheme", "ID_BETTING_SCHEME", (r) => usedOnlyByExcluded("ID_BETTING_SCHEME", r.ID_BETTING_SCHEME)],
    ["PRIZE_SCHEME", "PrizeScheme", "ID_PRIZE_SCHEME", (r) => prizeCols.every((c) => !fbEvents.some((e) => !EXCLUDED_EVENTS.has(e.ID_EVENT) && e[c] === r.ID_PRIZE_SCHEME)) && prizeCols.some((c) => fbEvents.some((e) => e[c] === r.ID_PRIZE_SCHEME))],
  ];
  for (const [fbT, pgT, pk, excl] of schemeTables) {
    const rows = FB(fbT).map((r) => (excl(r) ? { ...r, __skip: true } : r));
    await table(fbT, pgT, pk, { rows, isLegacy: legacyByCreator, extra: () => ({ CREATOR_ID: 1 }), skipUpdate: () => true });
    plan[fbT].finish();
  }
  // Scheme children: only for schemes inserted now; legacy schemes keep the portal's items.
  const newSchemes = (t) => new Set(plan[t].ins.map((r) => r[plan[t].pk]));
  const childRows = (fbT, parentT, parentCol) => {
    const fresh = new Set([...M[parentT]].filter(([fb, pgId]) => newSchemes(parentT).has(pgId)).map(([fb]) => fb));
    const all = FB(fbT);
    const skippedForLegacyParent = all.filter((r) => M[parentT].has(r[parentCol]) && !fresh.has(r[parentCol]));
    plan[parentT].childNotSynced = (plan[parentT].childNotSynced || 0) + skippedForLegacyParent.length;
    return all.filter((r) => fresh.has(r[parentCol]));
  };
  // Children of new schemes are always inserted: treat any id that exists in Neon as a collision.
  for (const [fbT, pgT, pk, parentT, parentCol] of [
    ["PERCH_FEE_ITEM", "BirdFeeItems", "ID_PERCH_FEE_ITEM", "FEE_SCHEME", "ID_FEE_SCHEME"],
    ["STANDARD_SHOW_PERCENTAGE", "StandardShowPercentage", "ID_STANDARD_SHOW_PERCENTAGE", "BETTING_SCHEME", "ID_BETTING_SCHEME"],
    ["PRIZE_SCHEME_ITEM", "PrizeSchemeItem", "ID_PRIZE_SCHEME_ITEM", "PRIZE_SCHEME", "ID_PRIZE_SCHEME"],
  ]) {
    await loadNeon(pgT, pk);
    const rows = childRows(fbT, parentT, parentCol);
    await table(fbT, pgT, pk, { rows, isLegacy: () => false, fk: { [parentCol]: parentT }, required: [parentCol] });
    plan[fbT].finish();
  }
  // Legacy prize-scheme items that already exist in Neon (same id) also resolve, so
  // PRIZE_VALUE rows pointing at them map through.
  {
    const N = neon.PrizeSchemeItem;
    for (const r of FB("PRIZE_SCHEME_ITEM")) if (!M.PRIZE_SCHEME_ITEM.has(r.ID_PRIZE_SCHEME_ITEM) && N.has(r.ID_PRIZE_SCHEME_ITEM) && r.ID_PRIZE_SCHEME_ITEM <= 250) M.PRIZE_SCHEME_ITEM.set(r.ID_PRIZE_SCHEME_ITEM, r.ID_PRIZE_SCHEME_ITEM);
  }
  M.RACE_TYPE = new Map(FB("RACE_TYPE").map((r) => [r.ID_RACE_TYPE, r.ID_RACE_TYPE]));
  M.RACE_NUMBER_GROUP = new Map(FB("RACE_NUMBER_GROUP").map((r) => [r.ID_RACE_NUMBER_GROUP, r.ID_RACE_NUMBER_GROUP]));

  // ================================================================ events + seasons
  await loadNeon("Events", "ID_EVENT");
  const evRows = fbEvents.map((r) => (EXCLUDED_EVENTS.has(r.ID_EVENT) ? { ...r, __skip: true } : r));
  await table("EVENTS", "Events", "ID_EVENT", { rows: evRows, extra: () => ({ CREATOR_ID: 1 }), skipUpdate: () => true });
  plan.EVENTS.finish();
  M.SEASON = new Map(); // FB event id -> Neon season id
  for (const [fbId, pgId] of M.EVENTS) {
    const s = seasons.filter((x) => x.EVENT_ID === pgId);
    if (s.length === 1) M.SEASON.set(fbId, s[0].id);
  }
  let nextSeason = Math.max(...seasons.map((s) => s.id)) + 1;
  const seasonIns = [];
  const seasonUpd = [];
  const schemeRef = (fbT, id) => (id == null ? null : ref(fbT, id) ?? null);
  for (const e of fbEvents) {
    if (EXCLUDED_EVENTS.has(e.ID_EVENT)) continue;
    const pointers = {
      ID_FEE_SCHEME: schemeRef("FEE_SCHEME", e.ID_FEE_SCHEME),
      ID_BETTING_SCHEME: schemeRef("BETTING_SCHEME", e.ID_BETTING_SCHEME),
      ID_FINAL_PRIZE_SCHEME: schemeRef("PRIZE_SCHEME", e.ID_FINAL_PRIZE_SCHEME),
      ID_HOT_SPOT1_PRIZE_SCHEME: schemeRef("PRIZE_SCHEME", e.ID_HOT_SPOT1_PRIZE_SCHEME),
      ID_HOT_SPOT2_PRIZE_SCHEME: schemeRef("PRIZE_SCHEME", e.ID_HOT_SPOT2_PRIZE_SCHEME),
      ID_HOT_SPOT3_PRIZE_SCHEME: schemeRef("PRIZE_SCHEME", e.ID_HOT_SPOT3_PRIZE_SCHEME),
      ID_HOT_SPOT_AVG_PRIZE_SCHEME: schemeRef("PRIZE_SCHEME", e.ID_HOT_SPOT_AVG_PRIZE_SCHEME),
    };
    if (M.SEASON.has(e.ID_EVENT)) {
      const s = seasons.find((x) => x.id === M.SEASON.get(e.ID_EVENT));
      const diff = Object.entries(pointers).filter(([k, v]) => v !== s[k]);
      if (diff.length) seasonUpd.push({ season: s, event: e, diff });
    } else {
      // Same shape as the seasons made from legacy events: starts the day before the
      // event date (00:00), shared far end date, active.
      const d = new Date(e.EVENT_DATE + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - 1);
      const id = nextSeason++;
      M.SEASON.set(e.ID_EVENT, id);
      seasonIns.push({ id, name: e.EVENT_NAME, startDate: d.toISOString().slice(0, 10) + " 00:00:00", endDate: "2027-01-29 11:30:23.851", isActive: true, EVENT_ID: M.EVENTS.get(e.ID_EVENT), ...pointers });
    }
  }
  const toSeason = (v) => M.SEASON.get(v);

  // ================================================================ people, races, entries
  const breederRows = FB("BREEDERS").map((r) => (onlyExcluded(breederUse.get(r.ID_BREEDER)) && r.ID_BREEDER > CUTOFF.BREEDERS ? { ...r, __skip: true } : r));
  await table("BREEDERS", "Breeders", "ID_BREEDER", { rows: breederRows });
  plan.BREEDERS.finish();

  const arrivedByRace = new Set();
  const fbRes = new Map(FB("RACE_ITEM_RESULT").map((r) => [r.ID_RACE_ITEM, r]));
  const fbRaceItems = FB("RACE_ITEM");
  for (const ri of fbRaceItems) if (fbRes.get(ri.ID_RACE_ITEM)?.ARRIVAL_TIME) arrivedByRace.add(ri.ID_RACE);
  const raceRows = fbRaces.map((r) => (exclRaces.has(r.ID_RACE) ? { ...r, __skip: true } : r));
  await table("RACE", "Race", "ID_RACE", {
    rows: raceRows,
    rename: { ID_EVENT: "SEASON_ID" },
    fk: { ID_EVENT: toSeason, ID_RACE_TYPE: "RACE_TYPE" },
    required: ["ID_EVENT"],
    extra: (r) => ({ STATUS: r.IS_CLOSED === 1 || arrivedByRace.has(r.ID_RACE) ? "ENDED" : "REGISTERING" }),
  });
  plan.RACE.finish();
  // HayLoft marks lost birds with sentinel race ids that have no RACE row; the original
  // import created stub races with these ids in Neon.
  for (const id of [7777, 8888, 9999]) if (neon.Race.has(id)) M.RACE.set(id, id);

  // Bird owner = breeder of the bird's latest entry (how the legacy birds were set).
  const invById = new Map(fbInv.map((r) => [r.ID_EVENT_INVENTORY, r]));
  const lastItem = new Map();
  for (const it of fbItems) if (!exclItems.has(it.ID_EVENT_INVENTORY_ITEM) && (lastItem.get(it.ID_BIRD)?.ID_EVENT_INVENTORY_ITEM ?? -1) < it.ID_EVENT_INVENTORY_ITEM) lastItem.set(it.ID_BIRD, it);
  const birdRows = FB("BIRDS").map((r) => (onlyExcluded(birdUse.get(r.ID_BIRD)) && r.ID_BIRD > CUTOFF.BIRDS ? { ...r, __skip: true } : r));
  await table("BIRDS", "Birds", "ID_BIRD", {
    rows: birdRows,
    fk: { LOST_ID_RACE: "RACE", ID_PICTURE: () => null },
    extra: (r) => {
      const it = lastItem.get(r.ID_BIRD);
      const br = it ? invById.get(it.ID_EVENT_INVENTORY)?.ID_BREEDER : null;
      return { breederId: br == null ? null : ref("BREEDERS", br) ?? null, IS_PUBLIC: 1 };
    },
  });
  plan.BIRDS.finish();
  // Owner follows HayLoft for legacy birds too (birds transferred to a new owner there).
  // Resolved after registrations are mapped; see "bird owners" below.

  const invRows = fbInv.map((r) => (exclInv.has(r.ID_EVENT_INVENTORY) ? { ...r, __skip: true } : r));
  await table("EVENT_INVENTORY", "EventInventory", "ID_EVENT_INVENTORY", {
    rows: invRows,
    rename: { ID_EVENT: "SEASON_ID" },
    fk: { ID_EVENT: toSeason, ID_BREEDER: "BREEDERS" },
    required: ["ID_EVENT"],
  });
  plan.EVENT_INVENTORY.finish();

  // bird owners: legacy birds whose latest HayLoft entry belongs to a different breeder.
  {
    const p = plan.BIRDS;
    const updById = new Map(p.upd.map((u) => [u.id, u]));
    for (const it of p.items) {
      if (it.kind !== "match") continue;
      const li = lastItem.get(it.r.ID_BIRD);
      const br = li ? invById.get(li.ID_EVENT_INVENTORY)?.ID_BREEDER : null;
      const owner = br == null ? null : ref("BREEDERS", br) ?? null;
      if (owner == null || owner === it.n.breederId) continue;
      let u = updById.get(it.r.ID_BIRD);
      if (!u) { u = { id: it.r.ID_BIRD, set: {} }; p.upd.push(u); updById.set(u.id, u); }
      u.set.breederId = owner;
      p.winsCount.breederId = (p.winsCount.breederId || 0) + 1;
    }
  }

  const itemRows = fbItems.map((r) => (exclItems.has(r.ID_EVENT_INVENTORY_ITEM) ? { ...r, __skip: true } : r));
  await table("EVENT_INVENTORY_ITEM", "EventInventoryItem", "ID_EVENT_INVENTORY_ITEM", {
    rows: itemRows,
    fk: { ID_BIRD: "BIRDS", ID_EVENT_INVENTORY: "EVENT_INVENTORY", ID_REPLACED_ITEM: "EVENT_INVENTORY_ITEM" },
    required: ["ID_EVENT_INVENTORY"],
    skipUpdate: (n) => n.DELETED_AT !== null, // soft-deleted in the portal: leave alone
  });
  plan.EVENT_INVENTORY_ITEM.finish();

  await table("PAYMENTS", "Payments", "ID_PAYMENT", {
    rows: FB("PAYMENTS").map((r) => (exclInv.has(r.ID_EVENT_INVENTORY) ? { ...r, __skip: true } : r)),
    fk: { ID_EVENT_INVENTORY: "EVENT_INVENTORY", ID_PICTURE: () => null },
    extra: () => ({ status: "PAID" }), // imported history counts as paid (20261009_payments_imported_history_paid)
  });
  plan.PAYMENTS.finish();

  // ================================================================ race items + results
  const ignored = new Set(FB("RACE_IGNORE_BIRD").map((r) => r.ID_RACE + ":" + r.ID_EVENT_INVENTORY_ITEM));
  const statusOf = (ri) => {
    const arr = fbRes.get(ri.ID_RACE_ITEM)?.ARRIVAL_TIME;
    if (arr && ignored.has(ri.ID_RACE + ":" + ri.ID_INVENTORY_ITEM)) return "IGNORED";
    if (arr) return "ARRIVED";
    if (ri.IS_LOST === 1) return "LOST";
    if (ri.ID_RACE_BASKET != null || ri.IS_DIST_BASKETED === 1) return "RELEASED";
    return "REGISTERED";
  };
  await table("RACE_ITEM", "RaceItem", "ID_RACE_ITEM", {
    rows: fbRaceItems.map((r) => (exclRaces.has(r.ID_RACE) || exclItems.has(r.ID_INVENTORY_ITEM) ? { ...r, __skip: true } : r)),
    fk: { ID_RACE: "RACE", ID_INVENTORY_ITEM: "EVENT_INVENTORY_ITEM", LOST_ID_RACE: "RACE" },
    required: ["ID_RACE", "ID_INVENTORY_ITEM"],
    extra: (r) => ({ status: statusOf(r) }),
  });
  plan.RACE_ITEM.finish();
  // Legacy race items HayLoft changed: recompute their status too.
  {
    const p = plan.RACE_ITEM;
    const byId = new Map(fbRaceItems.map((r) => [r.ID_RACE_ITEM, r]));
    for (const u of p.upd) {
      const s = statusOf(byId.get(u.id));
      if (s !== neon.RaceItem.get(u.id).status) { u.set.status = s; p.winsCount.status = (p.winsCount.status || 0) + 1; }
    }
    // Rule check against the original import.
    let ok = 0, bad = 0;
    const badBy = {};
    for (const it of p.items) if (it.kind === "match") {
      const s = statusOf(it.r);
      if (s === it.n.status) ok++;
      else { bad++; const k = `${it.n.status}->${s}`; badBy[k] = (badBy[k] || 0) + 1; }
    }
    p.statusCheck = { ok, bad, badBy };
  }

  // Results: keyed by race item; follow RACE_ITEM's mapping.
  await loadNeon("RaceItemResult", "ID_RACE_ITEM");
  {
    const cols = await pgColsOf("RaceItemResult");
    const p = (plan.RACE_ITEM_RESULT = { pgT: "RaceItemResult", pk: "ID_RACE_ITEM", ins: [], upd: [], st: { match: 0, new: 0, unresolved: 0 }, fills: {}, winsCount: {}, kept: {}, droppedRef: {}, rename: {} });
    for (const r of fbRes.values()) {
      const id = ref("RACE_ITEM", r.ID_RACE_ITEM);
      if (id === undefined) { p.st.unresolved++; continue; }
      const b = build("RACE_ITEM_RESULT", r, cols, {});
      b.ID_RACE_ITEM = id;
      const n = neon.RaceItemResult.get(id);
      if (n && id === r.ID_RACE_ITEM && r.ID_RACE_ITEM <= CUTOFF.RACE_ITEM) { p.st.match++; diffUpdate("RACE_ITEM_RESULT", id, b, n, ["ID_RACE_ITEM"]); }
      else if (n) { p.st.unresolved++; } // cannot happen for remapped ids (fresh)
      else { p.st.new++; p.ins.push(b); }
    }
  }

  // ================================================================ the rest
  const simple = [
    ["RACE_IGNORE_BIRD", "RaceIgnoreBird", "ID_IGNORE_BIRD", { ID_RACE: "RACE", ID_EVENT_INVENTORY_ITEM: "EVENT_INVENTORY_ITEM" }, ["ID_RACE", "ID_EVENT_INVENTORY_ITEM"]],
    ["LOST_HISTORY", "LostHistory", "ID_LOST_HISTORY", { ID_BIRD: "BIRDS", ID_RACE: "RACE" }, ["ID_BIRD"]],
    ["RACE_PHANTOM_BIRD", "RacePhantomBird", "ID_RACE_PHANTOM_BIRD", { ID_RACE: "RACE", ID_BIRD: "BIRDS", ID_EVENT: "EVENTS" }, ["ID_RACE"]],
    ["PRIZE_VALUE", "PrizeValue", "ID_PRIZE_VALUE", { ID_EVENT: toSeason, ID_PRIZE_SCHEME_ITEM: "PRIZE_SCHEME_ITEM", ID_RACE_TYPE: "RACE_TYPE" }, ["ID_EVENT", "ID_PRIZE_SCHEME_ITEM"], { ID_EVENT: "SEASON_ID" }],
  ];
  for (const [fbT, pgT, pk, fk, required, rename = {}] of simple) {
    await table(fbT, pgT, pk, { fk, required, rename });
    plan[fbT].finish();
  }

  // Composite / FK-keyed tables: insert when missing after mapping, else HayLoft wins.
  async function keyed(fbT, pgT, keyCols, fk, rename = {}) {
    const pgKey = keyCols.map((k) => rename[k] || k);
    await loadNeon(pgT, pgKey);
    const cols = await pgColsOf(pgT);
    const p = (plan[fbT] = { pgT, pk: pgKey, ins: [], upd: [], st: { match: 0, new: 0, unresolved: 0 }, fills: {}, winsCount: {}, kept: {}, droppedRef: {}, rename });
    const seen = new Set();
    for (const r of FB(fbT)) {
      const b = build(fbT, r, cols, fk, rename, keyCols);
      if (!b) { p.st.unresolved++; continue; }
      const k = pgKey.map((x) => b[x]).join(":");
      if (seen.has(k)) continue;
      seen.add(k);
      const n = neon[pgT].get(k);
      if (n) { p.st.match++; diffUpdate(fbT, k, b, n, pgKey); }
      else { p.st.new++; p.ins.push(b); }
    }
  }
  await keyed("PARTNERS", "Partners", ["ID_BREEDER", "ID_EVENT_INVENTORY"], { ID_BREEDER: "BREEDERS", ID_EVENT_INVENTORY: "EVENT_INVENTORY" });
  await keyed("RACE_ITEM_SCAN", "RaceItemScan", ["ID_RACE", "ID_RACE_ITEM"], { ID_RACE: "RACE", ID_RACE_ITEM: "RACE_ITEM" });
  await keyed("AVG_WINNER_PRIZES", "AvgWinnerPrizes", ["ID_EVENT_INVENTORY_ITEM"], { ID_EVENT_INVENTORY_ITEM: "EVENT_INVENTORY_ITEM", ID_EVENT: toSeason }, { ID_EVENT: "SEASON_ID" });
  await keyed("EVENT_RACE_NUMBER", "EventRaceNumber", ["ID_EVENT", "ID_NUMBER_GROUP"], { ID_EVENT: toSeason, ID_NUMBER_GROUP: "RACE_NUMBER_GROUP" }, { ID_EVENT: "SEASON_ID" });

  // ================================================================ baskets (race baskets of new races)
  const newRaces = new Set(plan.RACE.ins.map((r) => r.ID_RACE));
  const raceByPg = new Map(plan.RACE.ins.map((r) => [r.ID_RACE, r]));
  const fbRaceById = new Map(fbRaces.map((r) => [r.ID_RACE, r]));
  const basketMax = (await q(`SELECT COALESCE(MAX("ID_EVENT_BASKET"),0) m FROM "EventBaskets"`)).rows[0].m;
  let nextBasket = basketMax + 1;
  const basketIns = [];
  M.BASKET = new Map();
  const bKey = new Map();
  for (const b of FB("BASKET")) {
    if (b.IS_RACE_BASKET !== 1) continue;
    const raceId = ref("RACE", b.ID_RACE);
    if (!raceId || !newRaces.has(raceId)) continue;
    const k = raceId + ":" + b.BASKET_NO;
    if (bKey.has(k)) { M.BASKET.set(b.ID_BASKET, bKey.get(k)); continue; }
    const id = nextBasket++;
    bKey.set(k, id);
    M.BASKET.set(b.ID_BASKET, id);
    const race = raceByPg.get(raceId);
    basketIns.push({ ID_EVENT_BASKET: id, BASKET_NO: b.BASKET_NO, CAPACITY: b.CAPACITY ?? 0, PHASE: "RACE", LABEL: `Race ${race.RACE_NUMBER} · Basket #${b.BASKET_NO}`, ID_RACE: raceId, SEASON_ID: race.SEASON_ID });
  }
  const assignIns = [];
  {
    const insertedItems = new Set(plan.RACE_ITEM.ins.map((r) => r.ID_RACE_ITEM));
    const seen = new Set();
    for (const ri of fbRaceItems) {
      if (ri.ID_RACE_BASKET == null) continue;
      const basket = M.BASKET.get(ri.ID_RACE_BASKET);
      const raceItemPg = ref("RACE_ITEM", ri.ID_RACE_ITEM);
      if (!basket || !insertedItems.has(raceItemPg)) continue;
      const item = ref("EVENT_INVENTORY_ITEM", ri.ID_INVENTORY_ITEM);
      if (!item || seen.has(item + ":" + basket)) continue;
      seen.add(item + ":" + basket);
      const at = xf("RACE_ITEM", "RACE_BASKET_TIME", ri.RACE_BASKET_TIME) ?? xf("RACE", "START_TIME", fbRaceById.get(ri.ID_RACE)?.START_TIME) ?? null;
      assignIns.push({ ID_EVENT_BASKET: basket, ID_EVENT_INVENTORY_ITEM: item, ...(at ? { ASSIGNED_AT: at } : {}) });
    }
  }

  // ================================================================ report
  log("\n## Seasons");
  for (const s of seasonIns) log(`  NEW season ${s.id} "${s.name}" for event ${s.EVENT_ID}, start ${s.startDate}, fee ${s.ID_FEE_SCHEME}, betting ${s.ID_BETTING_SCHEME}, final ${s.ID_FINAL_PRIZE_SCHEME}, HS ${s.ID_HOT_SPOT1_PRIZE_SCHEME}/${s.ID_HOT_SPOT2_PRIZE_SCHEME}/${s.ID_HOT_SPOT3_PRIZE_SCHEME}, avg ${s.ID_HOT_SPOT_AVG_PRIZE_SCHEME}`);
  for (const u of seasonUpd) log(`  season ${u.season.id} "${u.season.name}" (event ${u.event.ID_EVENT}) scheme pointers differ from HayLoft - NOT changed: ${u.diff.map(([k, v]) => `${k} neon=${u.season[k]} hayloft=${v}`).join(", ")}`);

  log("\n## Tables (insert / update)");
  const order = ["FEE_SCHEME", "BETTING_SCHEME", "PRIZE_SCHEME", "PERCH_FEE_ITEM", "STANDARD_SHOW_PERCENTAGE", "PRIZE_SCHEME_ITEM", "EVENTS", "BREEDERS", "RACE", "BIRDS", "EVENT_INVENTORY", "EVENT_INVENTORY_ITEM", "PAYMENTS", "PARTNERS", "RACE_ITEM", "RACE_ITEM_RESULT", "RACE_ITEM_SCAN", "RACE_IGNORE_BIRD", "LOST_HISTORY", "RACE_PHANTOM_BIRD", "AVG_WINNER_PRIZES", "PRIZE_VALUE", "EVENT_RACE_NUMBER"];
  for (const t of order) {
    const p = plan[t];
    const st = Object.entries(p.st).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(" ");
    log(`- ${t} -> ${p.pgT}: INSERT ${p.ins.length}, UPDATE ${p.upd.length}   [${st}]`);
    if (Object.keys(p.winsCount).length) log(`    hayloft wins: ${JSON.stringify(p.winsCount)}`);
    if (Object.keys(p.fills).length) log(`    filled blanks: ${JSON.stringify(p.fills)}`);
    if (Object.keys(p.kept).length) log(`    portal kept:  ${JSON.stringify(p.kept)}`);
    if (Object.keys(p.droppedRef).length) log(`    refs nulled (target not synced): ${JSON.stringify(p.droppedRef)}`);
    if (p.childNotSynced) log(`    child rows of existing schemes left as the portal has them: ${p.childNotSynced}`);
  }
  log(`- EventBaskets: INSERT ${basketIns.length}`);
  log(`- BasketAssignments: INSERT ${assignIns.length}`);
  const rs = plan.RACE_ITEM.statusCheck;
  log(`\n## Race item status rule vs original import: ${rs.ok} match, ${rs.bad} differ ${JSON.stringify(rs.badBy)}`);

  // Money and per-event view.
  const sum = (a, f) => a.reduce((s, r) => s + (Number(f(r)) || 0), 0);
  const seasonOfInv = new Map([...plan.EVENT_INVENTORY.ins].map((r) => [r.ID_EVENT_INVENTORY, r.SEASON_ID]));
  for (const [id, n] of neon.EventInventory) seasonOfInv.set(id, seasonOfInv.get(id) ?? n.SEASON_ID);
  const bySeason = {};
  const bump = (s, k, v = 1) => ((bySeason[s] ??= {})[k] = ((bySeason[s] ??= {})[k] || 0) + v);
  for (const r of plan.EVENT_INVENTORY.ins) bump(r.SEASON_ID, "registrations");
  const itemSeason = new Map();
  for (const r of plan.EVENT_INVENTORY_ITEM.ins) { const s = seasonOfInv.get(r.ID_EVENT_INVENTORY); itemSeason.set(r.ID_EVENT_INVENTORY_ITEM, s); bump(s, "entries"); }
  for (const r of plan.PAYMENTS.ins) { const s = seasonOfInv.get(r.ID_EVENT_INVENTORY); bump(s, "payments"); bump(s, "payment $", r.PAYMENT_VALUE || 0); }
  for (const r of plan.RACE.ins) bump(r.SEASON_ID, "races");
  const raceSeason = new Map(plan.RACE.ins.map((r) => [r.ID_RACE, r.SEASON_ID]));
  for (const [id, n] of neon.Race) raceSeason.set(id, raceSeason.get(id) ?? n.SEASON_ID);
  for (const r of plan.RACE_ITEM.ins) bump(raceSeason.get(r.ID_RACE), "race items");
  log("\n## New rows by season");
  const sName = (id) => seasons.find((s) => s.id === +id)?.name ?? seasonIns.find((s) => s.id === +id)?.name;
  for (const [s, v] of Object.entries(bySeason)) log(`  season ${s} "${sName(s)}": ${Object.entries(v).map(([k, x]) => `${k} ${k.includes("$") ? x.toFixed(2) : x}`).join(", ")}`);
  log(`  payments updated: ${plan.PAYMENTS.upd.length}, value change ${sum(plan.PAYMENTS.upd, (u) => (u.set.PAYMENT_VALUE ?? neon.Payments.get(u.id).PAYMENT_VALUE) - neon.Payments.get(u.id).PAYMENT_VALUE).toFixed(2)}`);

  // Legacy rows HayLoft no longer has (deleted there after the import): report only.
  log("\n## Legacy rows in Neon that HayLoft no longer has (left alone)");
  for (const t of ["BREEDERS", "BIRDS", "EVENT_INVENTORY", "EVENT_INVENTORY_ITEM", "PAYMENTS", "RACE", "RACE_ITEM"]) {
    const p = plan[t];
    const fbIds = new Set(FB(t).map((r) => r[p.pk]));
    let n = 0;
    for (const id of neon[p.pgT].keys()) if (id <= CUTOFF[t] && !fbIds.has(id)) n++;
    log(`  ${t}: ${n}`);
  }

  // ================================================================ write
  log("\n## Writing (inside one transaction)");
  await q("BEGIN");
  const t0 = Date.now();
  async function insert(pgT, rows) {
    if (!rows.length) return 0;
    const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const per = Math.max(1, Math.floor(30000 / cols.length));
    for (let i = 0; i < rows.length; i += per) {
      const chunk = rows.slice(i, i + per);
      const vals = [];
      const ph = chunk.map((r) => "(" + cols.map((c) => (vals.push(r[c] === undefined ? null : r[c]), `$${vals.length}`)).join(",") + ")");
      await q(`INSERT INTO "${pgT}" (${cols.map((c) => `"${c}"`).join(",")}) VALUES ${ph.join(",")}`, vals);
    }
    return rows.length;
  }
  async function update(pgT, pk, ups) {
    for (const u of ups) {
      const cols = Object.keys(u.set);
      const vals = cols.map((c) => u.set[c]);
      const keyCols = Array.isArray(pk) ? pk : [pk];
      const keyVals = Array.isArray(pk) ? String(u.id).split(":").map(Number) : [u.id];
      const where = keyCols.map((k, i) => `"${k}"=$${cols.length + i + 1}`).join(" AND ");
      await q(`UPDATE "${pgT}" SET ${cols.map((c, i) => `"${c}"=$${i + 1}`).join(",")} WHERE ${where}`, [...vals, ...keyVals]);
    }
  }
  const counts = {};
  try {
    for (const t of ["FEE_SCHEME", "BETTING_SCHEME", "PRIZE_SCHEME", "PERCH_FEE_ITEM", "STANDARD_SHOW_PERCENTAGE", "PRIZE_SCHEME_ITEM", "EVENTS"]) counts[t] = await insert(plan[t].pgT, plan[t].ins);
    counts.Seasons = await insert("Seasons", seasonIns);
    for (const t of ["BREEDERS", "RACE"]) counts[t] = await insert(plan[t].pgT, plan[t].ins);
    // Birds before entries; Birds.LOST_ID_RACE needs races.
    counts.BIRDS = await insert("Birds", plan.BIRDS.ins);
    counts.EVENT_INVENTORY = await insert("EventInventory", plan.EVENT_INVENTORY.ins);
    // Self-reference: insert entries without ID_REPLACED_ITEM, then set it.
    const repl = plan.EVENT_INVENTORY_ITEM.ins.filter((r) => r.ID_REPLACED_ITEM != null).map((r) => ({ id: r.ID_EVENT_INVENTORY_ITEM, set: { ID_REPLACED_ITEM: r.ID_REPLACED_ITEM } }));
    counts.EVENT_INVENTORY_ITEM = await insert("EventInventoryItem", plan.EVENT_INVENTORY_ITEM.ins.map((r) => ({ ...r, ID_REPLACED_ITEM: null })));
    await update("EventInventoryItem", "ID_EVENT_INVENTORY_ITEM", repl);
    for (const t of ["PAYMENTS", "PARTNERS", "RACE_ITEM", "RACE_ITEM_RESULT", "RACE_ITEM_SCAN", "RACE_IGNORE_BIRD", "LOST_HISTORY", "RACE_PHANTOM_BIRD", "AVG_WINNER_PRIZES", "PRIZE_VALUE", "EVENT_RACE_NUMBER"]) {
      counts[t] = await insert(plan[t].pgT, plan[t].ins);
      process.stdout.write(`  inserted ${t} ${counts[t]} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
    }
    counts.EventBaskets = await insert("EventBaskets", basketIns);
    counts.BasketAssignments = await insert("BasketAssignments", assignIns);
    for (const t of order) await update(plan[t].pgT, plan[t].pk, plan[t].upd);
    // HayLoft links a payment only through its registration; the breeder-facing
    // payment screens look payments up by ID_BREEDER, so copy it across.
    const pb = await q(`UPDATE "Payments" p SET "ID_BREEDER" = ei."ID_BREEDER" FROM "EventInventory" ei
      WHERE ei."ID_EVENT_INVENTORY" = p."ID_EVENT_INVENTORY" AND p."ID_BREEDER" IS NULL AND ei."ID_BREEDER" IS NOT NULL`);
    log(`  payments given their registration's breeder: ${pb.rowCount}`);
    // Sequences past every id now in use.
    for (const [pgT, col] of [["FeeScheme", "ID_FEE_SCHEME"], ["BettingScheme", "ID_BETTING_SCHEME"], ["PrizeScheme", "ID_PRIZE_SCHEME"], ["BirdFeeItems", "ID_PERCH_FEE_ITEM"], ["StandardShowPercentage", "ID_STANDARD_SHOW_PERCENTAGE"], ["PrizeSchemeItem", "ID_PRIZE_SCHEME_ITEM"], ["Events", "ID_EVENT"], ["Seasons", "id"], ["Breeders", "ID_BREEDER"], ["Race", "ID_RACE"], ["Birds", "ID_BIRD"], ["EventInventory", "ID_EVENT_INVENTORY"], ["EventInventoryItem", "ID_EVENT_INVENTORY_ITEM"], ["Payments", "ID_PAYMENT"], ["RaceItem", "ID_RACE_ITEM"], ["RaceIgnoreBird", "ID_IGNORE_BIRD"], ["LostHistory", "ID_LOST_HISTORY"], ["RacePhantomBird", "ID_RACE_PHANTOM_BIRD"], ["PrizeValue", "ID_PRIZE_VALUE"], ["EventBaskets", "ID_EVENT_BASKET"], ["BasketAssignments", "ID_BASKET_ASSIGNMENT"]]) {
      await q(`SELECT setval(pg_get_serial_sequence('"${pgT}"', '${col}'), GREATEST((SELECT MAX("${col}") FROM "${pgT}"), 1))`);
    }
    // Post-write check, inside the transaction.
    const after = (await q(`SELECT (SELECT COUNT(*) FROM "Events")::int ev, (SELECT COUNT(*) FROM "Seasons")::int se, (SELECT COUNT(*) FROM "Breeders")::int br, (SELECT COUNT(*) FROM "Birds")::int bi, (SELECT COUNT(*) FROM "EventInventory")::int inv, (SELECT COUNT(*) FROM "EventInventoryItem")::int it, (SELECT COUNT(*) FROM "Payments")::int pay, (SELECT ROUND(SUM("PAYMENT_VALUE")::numeric,2)::text FROM "Payments") paysum, (SELECT COUNT(*) FROM "Race")::int ra, (SELECT COUNT(*) FROM "RaceItem")::int ri, (SELECT COUNT(*) FROM "RaceItemResult")::int rr`)).rows[0];
    log(`  after: ${JSON.stringify(after)}`);
    log(`  write time ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    if (APPLY) { await q("COMMIT"); log("\nCOMMITTED."); }
    else { await q("ROLLBACK"); log("\nDRY RUN: rolled back, nothing changed."); }
  } catch (e) {
    await q("ROLLBACK");
    log("\nFAILED, rolled back: " + e.message + (e.detail ? " / " + e.detail : ""));
    process.exitCode = 1;
  }

  // Id map for the next sync (HayLoft id -> Neon id where they differ).
  const idMap = {};
  for (const [t, m] of Object.entries(M)) {
    const d = [...m].filter(([a, b]) => a !== b);
    if (d.length) idMap[t] = Object.fromEntries(d);
  }
  fs.writeFileSync(path.join(DUMP, APPLY ? "id-map.json" : "id-map.dry-run.json"), JSON.stringify(idMap, null, 1));
  fs.writeFileSync(path.join(DUMP, APPLY ? "sync-report.txt" : "sync-report.dry-run.txt"), report.join("\n"));
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
