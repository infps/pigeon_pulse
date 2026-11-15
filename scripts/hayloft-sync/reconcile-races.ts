/**
 * The portal's race engine (lib/race-results) against HayLoft's (RACE_RECALC).
 *
 *   node scripts/hayloft-sync/hayloft-race-oracle.cjs <scratch-copy.FDB> <dump-dir>/race-oracle.json
 *   bun scripts/hayloft-sync/reconcile-races.ts <dump-dir> [raceId ...]
 *
 * Both engines recompute positions, hot spot positions and prizes from the
 * same data: HayLoft's on a scratch copy of the .FDB, the portal's as a dry run
 * (rolled back, nothing is written). Any difference is a difference in how the
 * two systems rank and pay, which is what future races would inherit.
 * Race and race-item ids go through <dump-dir>/id-map.json. Exits 1 on any difference.
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { recalcRace } from "@/lib/race-results";

const dumpDir = process.argv[2];
if (!dumpDir || !fs.existsSync(path.join(dumpDir, "race-oracle.json"))) {
  console.error("usage: bun scripts/hayloft-sync/reconcile-races.ts <dump-dir with race-oracle.json> [raceId ...]");
  process.exit(2);
}
const only = new Set(process.argv.slice(3).map(Number));
type Row = { ID_RACE_ITEM: number; BIRD_POSITION: number | null; BIRD_POSITION_HOT_SPOT: number | null; PRIZE_VALUE: number | null };
const oracle: Record<string, Row[]> = JSON.parse(fs.readFileSync(path.join(dumpDir, "race-oracle.json"), "utf8"));
const idMap = fs.existsSync(path.join(dumpDir, "id-map.json")) ? JSON.parse(fs.readFileSync(path.join(dumpDir, "id-map.json"), "utf8")) : {};
const raceMap: Record<string, number> = idMap.RACE ?? {};
const itemMap: Record<string, number> = idMap.RACE_ITEM ?? {};
const EXCLUDED_RACES = new Set<number>(); // e.g. TEST RACE races are not synced and simply won't be found

let failing = 0;
const totals = { position: 0, hotspot: 0, prize: 0, missing: 0 };
let prizeDelta = 0;
for (const [hlRaceKey, rows] of Object.entries(oracle)) {
  const hlRace = Number(hlRaceKey);
  const race = Number(raceMap[hlRace] ?? hlRace);
  if (EXCLUDED_RACES.has(hlRace) || (only.size && !only.has(hlRace) && !only.has(race))) continue;
  const exists = await prisma.race.findUnique({ where: { id: race }, select: { id: true, seasonId: true } });
  if (!exists) continue; // not synced (e.g. TEST RACE)
  const s = await recalcRace(race, { dryRun: true });
  // The portal's recomputed values: unchanged rows keep what is stored.
  const stored = await prisma.raceItemResult.findMany({
    where: { raceItem: { raceId: race } },
    select: { raceItemId: true, birdPosition: true, birdPositionHotSpot: true, prizeValue: true },
  });
  const after = new Map(stored.map((r) => [r.raceItemId, { position: r.birdPosition, hotspot: r.birdPositionHotSpot, prize: r.prizeValue }]));
  for (const c of s.changes) after.set(c.raceItemId, { position: c.after.position, hotspot: c.after.hotspotPosition, prize: c.after.prize });

  let diffs = 0;
  const examples: string[] = [];
  for (const r of rows) {
    const id = Number(itemMap[r.ID_RACE_ITEM] ?? r.ID_RACE_ITEM);
    const p = after.get(id);
    if (!p) { totals.missing++; diffs++; continue; }
    const bad: string[] = [];
    if ((p.position ?? null) !== (r.BIRD_POSITION ?? null)) { totals.position++; bad.push(`pos ${r.BIRD_POSITION}→${p.position}`); }
    if ((p.hotspot ?? null) !== (r.BIRD_POSITION_HOT_SPOT ?? null)) { totals.hotspot++; bad.push(`hs ${r.BIRD_POSITION_HOT_SPOT}→${p.hotspot}`); }
    if (Math.abs((p.prize ?? 0) - (r.PRIZE_VALUE ?? 0)) > 0.00005 || (p.prize == null) !== (r.PRIZE_VALUE == null)) {
      totals.prize++;
      prizeDelta += (p.prize ?? 0) - (r.PRIZE_VALUE ?? 0);
      bad.push(`prize ${r.PRIZE_VALUE}→${p.prize}`);
    }
    if (bad.length) { diffs++; if (examples.length < 3) examples.push(`item ${id}: hayloft→portal ${bad.join(", ")}`); }
  }
  if (diffs) {
    failing++;
    console.log(`race ${race} (season ${exists.seasonId}): ${diffs} of ${rows.length} rows differ`);
    for (const e of examples) console.log("   " + e);
  }
}
console.log(`\n${Object.keys(oracle).length} HayLoft races; ${failing} differ. Rows: ${JSON.stringify(totals)}; prize Δ ${prizeDelta.toFixed(4)}`);
await prisma.$disconnect();
process.exit(failing ? 1 : 0);
