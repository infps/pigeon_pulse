/**
 * Average-speed ranking and prizes: portal (lib/hayloft-avg-speed) vs HayLoft's
 * own RACE_AVG_SPEED_GET.
 *
 *   node scripts/hayloft-sync/hayloft-avg-oracle.cjs <copy.FDB> <dump-dir>/avg-oracle.json
 *   bun scripts/hayloft-sync/reconcile-avg-speed.ts <dump-dir> [eventId ...]
 *
 * Same races, same options, every bird: position, races flown, distance,
 * flight time, speeds and prize. Selections HayLoft itself cannot compute
 * (its NUMERIC overflow) are reported and skipped. Exits 1 on any difference.
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { averageSpeedWinners } from "@/lib/hayloft-avg-speed";

const dumpDir = process.argv[2];
if (!dumpDir || !fs.existsSync(path.join(dumpDir, "avg-oracle.json"))) {
  console.error("usage: bun scripts/hayloft-sync/reconcile-avg-speed.ts <dump-dir with avg-oracle.json> [eventId ...]");
  process.exit(2);
}
const only = new Set(process.argv.slice(3).map(Number));
type Row = Record<string, number | null>;
type Sel = { races: number[]; onlyHotSpotPaid: boolean; rows?: Row[]; error?: string };
const oracle: Record<string, Record<string, Sel>> = JSON.parse(fs.readFileSync(path.join(dumpDir, "avg-oracle.json"), "utf8"));
const idMap = fs.existsSync(path.join(dumpDir, "id-map.json")) ? JSON.parse(fs.readFileSync(path.join(dumpDir, "id-map.json"), "utf8")) : {};
const raceMap: Record<string, number> = idMap.RACE ?? {};
const itemMap: Record<string, number> = idMap.EVENT_INVENTORY_ITEM ?? {};

let failing = 0;
const summary: string[] = [];
for (const [evKey, sels] of Object.entries(oracle)) {
  const ev = Number(evKey);
  if (only.size && !only.has(ev)) continue;
  const seasons = await prisma.season.findMany({ where: { eventId: ev }, select: { id: true } });
  if (seasons.length !== 1) continue;
  for (const [name, sel] of Object.entries(sels)) {
    if (sel.error) { summary.push(`event ${ev} ${name}: HayLoft cannot compute it (${sel.error}) — skipped`); continue; }
    const races = sel.races.map((r) => Number(raceMap[r] ?? r));
    const pp = await averageSpeedWinners(seasons[0].id, races, { onlyHotSpotPaid: sel.onlyHotSpotPaid, calcPrize: true });
    const ppById = new Map(pp.map((r) => [r.inventoryItemId, r]));
    const diffs: string[] = [];
    let n = 0;
    let ties = 0;
    for (const h of sel.rows ?? []) {
      const id = Number(itemMap[h.ID_EVENT_INVENTORY_ITEM as number] ?? h.ID_EVENT_INVENTORY_ITEM);
      const p = ppById.get(id);
      if (!p) { n++; if (diffs.length < 4) diffs.push(`item ${id}: missing in portal`); continue; }
      const cmp: Array<[string, number | null, number | null, number]> = [
        ["position", h.BIRD_POSITION, p.position, 0],
        ["races", h.RACE_COUNT, p.raceCount, 0],
        ["distance", h.TOTAL_FLIGHT_DISTANCE, p.totalDistance, 0],
        ["flightMs", h.TOTAL_FLIGHT_TIME, p.totalFlightMs, 1],
        ["yardsPerMin", h.AVG_SPEED_IN_YARDS, p.yardsPerMin, 0.00005],
        ["mph", h.AVG_SPEED_IN_MILES, p.milesPerHour, 0.00005],
        ["prize", h.HOT_SPOT_PRIZE_VALUE, p.prize, 0.00005],
      ];
      const bad = cmp.filter(([, a, b, tol]) => (a == null) !== (b == null) || Math.abs((a ?? 0) - (b ?? 0)) > tol);
      // A bird with no speed (its flight time is not positive) ties with every
      // other such bird on HayLoft's sort keys, and HayLoft's order among them is
      // undefined. Only its position may differ, and only then is it not a failure.
      const onlyUnorderedTie = bad.length > 0 && bad.every(([k]) => k === "position" || k === "prize") && h.AVG_SPEED_IN_YARDS == null && p.yardsPerMin == null;
      if (onlyUnorderedTie) { ties++; continue; }
      if (bad.length) { n++; if (diffs.length < 4) diffs.push(`item ${id}: ` + bad.map(([k, a, b]) => `${k} ${a}→${b}`).join(", ")); }
    }
    if (pp.length !== (sel.rows ?? []).length) diffs.push(`bird count hayloft ${(sel.rows ?? []).length} · portal ${pp.length}`);
    const ok = n === 0 && pp.length === (sel.rows ?? []).length;
    if (!ok) { failing++; console.log(`event ${ev} ${name}: ${n} birds differ`); for (const d of diffs) console.log("   " + d); }
    summary.push(`event ${ev} ${name}: ${(sel.rows ?? []).length} birds — ${ok ? "all match" : "DIFFERS"}${ties ? ` (${ties} speedless birds in HayLoft-undefined order)` : ""}`);
  }
}
console.log("\n## Summary\n" + summary.join("\n"));
await prisma.$disconnect();
process.exit(failing ? 1 : 0);
