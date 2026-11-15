/**
 * Every event's Details screen and Accounting totals, against HayLoft.
 *
 *   node scripts/hayloft-sync/hayloft-oracle.cjs <copy.FDB> <dump-dir>/oracle.json
 *   bun scripts/hayloft-sync/reconcile-details.ts <dump-dir> [eventId ...]
 *
 * HayLoft side: oracle.json — the per-registration rows of HayLoft's stored
 * procedure EVENT_INVENTORY_GET, which HayLoft's Details screen totals. The only
 * arithmetic added here is the screen's commission lines (cut % of what was
 * kept after refunds, checked against HayLoft's AGN 2025 screen).
 * Pigeon Pulse side: the real dashboard-stats route and lib/accounting, on the
 * DB in .env (auth stubbed out).
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
if (!dumpDir || !fs.existsSync(path.join(dumpDir, "oracle.json"))) {
  console.error("usage: bun scripts/hayloft-sync/reconcile-details.ts <dump-dir with oracle.json and EVENTS.json> [eventId ...]");
  process.exit(2);
}
const only = new Set(process.argv.slice(3).map(Number));
const EXCLUDED_EVENTS = new Set([21]); // TEST RACE, not synced

type Row = Record<string, number | string | null>;
const oracle: Record<string, Row[]> = JSON.parse(fs.readFileSync(path.join(dumpDir, "oracle.json"), "utf8"));
const load = (t: string): Row[] => JSON.parse(fs.readFileSync(path.join(dumpDir, `${t}.json`), "utf8"));
const EVENTS = new Map(load("EVENTS").map((e) => [Number(e.ID_EVENT), e]));
const FEE = new Map(load("FEE_SCHEME").map((f) => [f.ID_FEE_SCHEME, f]));
const BET = new Map(load("BETTING_SCHEME").map((b) => [b.ID_BETTING_SCHEME, b]));
const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => Math.round(n * 100) / 100;

function hayloftDetails(ev: Row, rows: Row[]) {
  const cut = num(FEE.get(ev.ID_FEE_SCHEME)?.FEES_CUT_PERCENT);
  const betCut = num(BET.get(ev.ID_BETTING_SCHEME)?.BETTING_CUT_PERCENT);
  const S = (k: string) => rows.reduce((s, r) => s + num(r[k]), 0);
  const entryFees = S("ENTRY_FEE_VALUE"), entryRefund = S("ENTRY_REFUND");
  const hotSpotFees = S("HOT_SPOT_VALUE"), hotSpotRefunds = S("HOT_SPOT_REFUND");
  const bets = S("BETS_VALUE"), betsRefund = S("BETS_REFUND");
  const entryCommission = (entryFees - entryRefund) * cut / 100;
  const hotSpotCommission = (hotSpotFees - hotSpotRefunds) * cut / 100;
  const betsCommission = (bets - betsRefund) * betCut / 100;
  return {
    totalPerchFee: S("PERCH_FEE_VALUE"),
    reservedBirds: S("RESERVED_BIRDS"),
    reservedWaiting: rows.reduce((s, r) => s + (num(r.IS_WAITING) === 1 ? num(r.RESERVED_BIRDS) : 0), 0),
    hereCount: S("IN_LOFT_BIRDS"),
    lostBirds: S("LOST_BIRDS"),
    replacedCount: S("REPLACED_BIRDS"),
    entryFeeBirds: S("ENTRY_BIRDS"),
    entryFees, entryRefund, entryCommission,
    entryTotalValue: entryFees - entryRefund - entryCommission,
    hotSpotBirds: S("HOT_SPOT_BIRDS"),
    hotSpotFees, hotSpotRefunds, hotSpotCommission,
    hotSpotValue: hotSpotFees - hotSpotRefunds - hotSpotCommission,
    totalBets: bets, betsRefund, betsCommission,
    betsValue: bets - betsRefund - betsCommission,
    paidPerchFee: S("PERCH_FEE_PAY_VALUE"),
    paidEntryFee: S("ENTRY_FEE_PAY_VALUE"),
    paidHotSpot: S("HOT_SPOT_PAY_VALUE"),
    paymentClasses: S("BETS_PAY_VALUE"),
    // Accounting tab
    "accounting.paid": S("TOTAL_PAYMENT_VALUE"),
    "accounting.won": S("WINNER_PAYOUT_VALUE"),
    "accounting.balance": S("BALANCE_VALUE"),
    "accounting.prizeStatementsTotal": S("WINNER_PAYOUT_VALUE"),
  };
}

const { prisma } = await import("@/lib/prisma");
const { GET } = await import("@/app/api/admin/event/[eventId]/dashboard-stats/route");
const { seasonLedger, prizeStatements } = await import("@/lib/accounting");

let failures = 0;
const summary: string[] = [];
for (const [evKey, rows] of Object.entries(oracle)) {
  const id = Number(evKey);
  const ev = EVENTS.get(id);
  if (!ev || EXCLUDED_EVENTS.has(id) || (only.size && !only.has(id)) || rows.length === 0) continue;
  const seasons = await prisma.season.findMany({ where: { eventId: id }, select: { id: true } });
  if (seasons.length !== 1) {
    console.log(`\n### event ${id} ${ev.EVENT_NAME}: ${seasons.length} seasons in the DB, expected 1 — SKIPPED`);
    failures++;
    continue;
  }
  const res = await GET(new Request(`http://local/api?seasonId=${seasons[0].id}`), {
    params: Promise.resolve({ eventId: String(id) }),
  });
  const pp = (await res.json()) as Record<string, number>;
  const [ledger, prizes] = await Promise.all([seasonLedger(seasons[0].id), prizeStatements(seasons[0].id)]);
  pp["accounting.paid"] = ledger.totals.paid;
  pp["accounting.won"] = ledger.totals.prizeEarned;
  pp["accounting.balance"] = ledger.totals.balance;
  pp["accounting.prizeStatementsTotal"] = prizes.total;

  const hl = hayloftDetails(ev, rows);
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
