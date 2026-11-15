/**
 * Reconcile every event's Details screen against HayLoft.
 *
 *   bun scripts/hayloft-sync/reconcile-details.ts <dump-dir> [eventId ...]
 *
 * HayLoft side: computed straight from the HayLoft export (export.cjs) with
 * HayLoft's own rules, written here independently of the app code:
 *   - stored procedures EVENT_BET_TOTALS (bets: active entries only, flags ×
 *     scheme price, commission = BETTING_CUT_PERCENT) and PAYMENT_CALC
 *     (payment types 0 perch, 1 entry, 2 bets, 3 hot spot, ...);
 *   - the Details screen, checked box by box against HayLoft's AGN 2025 screen.
 * Pigeon Pulse side: the real dashboard-stats route, run against the DB in .env
 * (auth stubbed out), for the season that holds the HayLoft event.
 *
 * Exits 1 if any figure differs, so it can gate a deploy.
 */
import { mock } from "bun:test";
import fs from "node:fs";
import path from "node:path";

mock.module("@/lib/authorize", () => ({ requirePermission: async () => ({ session: {} }) }));
mock.module("@/lib/auth", () => ({ auth: { api: { getSession: async () => null } } }));
mock.module("next/headers", () => ({ headers: async () => new Headers() }));

const dumpDir = process.argv[2];
if (!dumpDir || !fs.existsSync(path.join(dumpDir, "EVENTS.json"))) {
  console.error("usage: bun scripts/hayloft-sync/reconcile-details.ts <dump-dir> [eventId ...]");
  process.exit(2);
}
const only = new Set(process.argv.slice(3).map(Number));
const EXCLUDED_EVENTS = new Set([21]); // TEST RACE, not synced

type Row = Record<string, unknown>;
const load = (t: string): Row[] => JSON.parse(fs.readFileSync(path.join(dumpDir, `${t}.json`), "utf8"));
const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => Math.round(n * 100) / 100;

const EVENTS = load("EVENTS");
const INV = load("EVENT_INVENTORY");
const ITEMS = load("EVENT_INVENTORY_ITEM");
const BIRDS = new Map(load("BIRDS").map((b) => [b.ID_BIRD, b]));
const PAYMENTS = load("PAYMENTS");
const FEE = new Map(load("FEE_SCHEME").map((f) => [f.ID_FEE_SCHEME, f]));
const BET = new Map(load("BETTING_SCHEME").map((b) => [b.ID_BETTING_SCHEME, b]));
const RACES = load("RACE");
const RACE_ITEMS = load("RACE_ITEM");
const RESULTS = load("RACE_ITEM_RESULT");

const FLAGS: Array<[string, string]> = [];
for (let n = 1; n <= 7; n++) FLAGS.push([`BELGIAN_SHOW_BET_${n}`, `BELGIAN_SHOW_${n}`]);
for (let n = 1; n <= 6; n++) FLAGS.push([`STANDARD_SHOW_BET_${n}`, `STANDARD_SHOW_${n}`]);
for (let n = 1; n <= 5; n++) FLAGS.push([`WTA_BET_${n}`, `WTA_${n}`]);

function hayloftDetails(ev: Row) {
  const invs = INV.filter((r) => r.ID_EVENT === ev.ID_EVENT);
  const invIds = new Set(invs.map((r) => r.ID_EVENT_INVENTORY));
  const items = ITEMS.filter((r) => invIds.has(r.ID_EVENT_INVENTORY));
  const fee = FEE.get(ev.ID_FEE_SCHEME);
  const bs = BET.get(ev.ID_BETTING_SCHEME);
  const cut = num(fee?.FEES_CUT_PERCENT);
  const betCut = num(bs?.BETTING_CUT_PERCENT);
  const sum = (f: string) => items.reduce((s, r) => s + num(r[f]), 0);

  const entryFees = sum("ENTRY_FEE_VALUE"), entryRefund = sum("ENTRY_REFUND");
  const hotSpotFees = sum("HOT_SPOT_FEE_VALUE"), hotSpotRefunds = sum("HOT_SPOT_REFUND");
  let bets = 0;
  for (const it of items) {
    if (num(it.IS_BET_ACTIVE) === 0) continue; // EVENT_BET_TOTALS: IS_BET_ACTIVE <> 0
    for (const [flag, price] of FLAGS) if (num(it[flag]) === 1) bets += num(bs?.[price]);
  }
  const betsRefund = sum("BETS_REFUND");
  const entryCommission = (entryFees - entryRefund) * cut / 100;
  const hotSpotCommission = (hotSpotFees - hotSpotRefunds) * cut / 100;
  const betsCommission = (bets - betsRefund) * betCut / 100;

  const pays = PAYMENTS.filter((p) => invIds.has(p.ID_EVENT_INVENTORY));
  const paid = (t: number) => pays.filter((p) => num(p.PAYMENT_TYPE) === t && p.PAYMENT_TYPE != null).reduce((s, p) => s + num(p.PAYMENT_VALUE), 0);

  // Accounting tab: race prizes, and fee money received net of fee refunds
  // (PAYMENT_CALC types 0, 1, 3, 7 in; 4, 6 out — HayLoft stores out as negative).
  const races = new Set(RACES.filter((r) => r.ID_EVENT === ev.ID_EVENT).map((r) => r.ID_RACE));
  const raceItemIds = new Set(RACE_ITEMS.filter((r) => races.has(r.ID_RACE)).map((r) => r.ID_RACE_ITEM));
  const prizeTotal = RESULTS.filter((r) => raceItemIds.has(r.ID_RACE_ITEM)).reduce((s, r) => s + num(r.PRIZE_VALUE), 0);
  const ledgerFeesPaid = [0, 1, 3, 4, 6, 7].reduce((s, t) => s + paid(t), 0);

  return {
    totalPerchFee: sum("PERCH_FEE_VALUE"),
    reservedBirds: invs.reduce((s, r) => s + num(r.RESERVED_BIRDS), 0),
    hereCount: items.filter((r) => r.ID_REPLACED_ITEM == null).length,
    lostBirds: items.filter((r) => num(BIRDS.get(r.ID_BIRD)?.IS_LOST) === 1).length,
    replacedCount: items.filter((r) => r.ID_REPLACED_ITEM != null).length,
    entryFeeBirds: items.filter((r) => num(r.ENTRY_FEE_VALUE) > 0 && !(num(r.ENTRY_REFUND) > 0)).length,
    entryFees, entryRefund, entryCommission,
    entryTotalValue: entryFees - entryRefund - entryCommission,
    hotSpotBirds: items.filter((r) => num(r.HOT_SPOT_FEE_VALUE) > 0 && !(num(r.HOT_SPOT_REFUND) > 0)).length,
    hotSpotFees, hotSpotRefunds, hotSpotCommission,
    hotSpotValue: hotSpotFees - hotSpotRefunds - hotSpotCommission,
    totalBets: bets, betsRefund, betsCommission,
    betsValue: bets - betsRefund - betsCommission,
    paidPerchFee: paid(0), paidEntryFee: paid(1), paidHotSpot: paid(3), paymentClasses: paid(2),
    "accounting.prizeTotal": prizeTotal,
    "accounting.feesPaid": ledgerFeesPaid,
  };
}

const { prisma } = await import("@/lib/prisma");
const { GET } = await import("@/app/api/admin/event/[eventId]/dashboard-stats/route");
const { seasonLedger, prizeStatements } = await import("@/lib/accounting");

let failures = 0;
const summary: string[] = [];
for (const ev of EVENTS) {
  const id = Number(ev.ID_EVENT);
  if (EXCLUDED_EVENTS.has(id) || (only.size && !only.has(id))) continue;
  const seasons = await prisma.season.findMany({ where: { eventId: id }, select: { id: true, name: true } });
  if (seasons.length !== 1) {
    console.log(`\n### event ${id} ${ev.EVENT_NAME}: ${seasons.length} seasons in the DB, expected 1 — SKIPPED`);
    failures++;
    continue;
  }
  const res = await GET(new Request(`http://local/api?seasonId=${seasons[0].id}`), {
    params: Promise.resolve({ eventId: String(id) }),
  });
  const pp = (await res.json()) as Record<string, number>;
  // The Accounting tab, from the same library the page uses.
  const [ledger, prizes] = await Promise.all([seasonLedger(seasons[0].id), prizeStatements(seasons[0].id)]);
  pp["accounting.prizeTotal"] = prizes.total;
  pp["accounting.feesPaid"] = ledger.totals.paid;
  const hl = hayloftDetails(ev);
  const diffs: string[] = [];
  for (const [k, v] of Object.entries(hl)) {
    const a = r2(v), b = r2(Number(pp[k] ?? 0));
    if (Math.abs(a - b) > 0.005) diffs.push(`${k}: hayloft ${a} · pigeon pulse ${b} (Δ ${r2(b - a)})`);
  }
  const head = `event ${String(id).padStart(2)} ${String(ev.EVENT_NAME).padEnd(24)} season ${seasons[0].id}`;
  if (diffs.length) {
    failures++;
    console.log(`\n### ${head}: ${diffs.length} differ`);
    for (const d of diffs) console.log("   " + d);
  }
  summary.push(`${head}: ${diffs.length ? `${diffs.length} DIFFER` : "all match"}`);
}
console.log("\n## Summary\n" + summary.join("\n"));
await prisma.$disconnect();
process.exit(failures ? 1 : 0);
