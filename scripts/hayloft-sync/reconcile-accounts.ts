/**
 * Every registration's account, field by field, against HayLoft's own output.
 *
 *   node scripts/hayloft-sync/hayloft-oracle.cjs <copy.FDB> <dump-dir>/oracle.json
 *   bun scripts/hayloft-sync/reconcile-accounts.ts <dump-dir> [eventId ...]
 *
 * HayLoft side: oracle.json, the rows HayLoft's stored procedure
 * EVENT_INVENTORY_GET returns (fees, refunds, payments by type, prizes, bet
 * winnings, balance). Pigeon Pulse side: lib/hayloft-account, on the DB in .env.
 * HayLoft ids are mapped through <dump-dir>/id-map.json where the sync gave a
 * row a new id. Exits 1 on any difference of a cent or more.
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { seasonAccounts, type RegistrationAccount } from "@/lib/hayloft-account";

const dumpDir = process.argv[2];
if (!dumpDir || !fs.existsSync(path.join(dumpDir, "oracle.json"))) {
  console.error("usage: bun scripts/hayloft-sync/reconcile-accounts.ts <dump-dir with oracle.json> [eventId ...]");
  process.exit(2);
}
const only = new Set(process.argv.slice(3).map(Number));
const EXCLUDED_EVENTS = new Set([21]); // TEST RACE, not synced

type OracleRow = Record<string, number | string | null>;
const oracle: Record<string, OracleRow[]> = JSON.parse(fs.readFileSync(path.join(dumpDir, "oracle.json"), "utf8"));
const idMapFile = path.join(dumpDir, "id-map.json");
const invMap: Record<string, number> = fs.existsSync(idMapFile)
  ? (JSON.parse(fs.readFileSync(idMapFile, "utf8")).EVENT_INVENTORY ?? {})
  : {};

const n = (v: unknown) => (v == null ? 0 : Number(v));
const FIELDS: Array<[string, (a: RegistrationAccount) => number]> = [
  ["RESERVED_BIRDS", (a) => a.reservedBirds],
  ["IN_LOFT_BIRDS", (a) => a.inLoftBirds],
  ["LOST_BIRDS", (a) => a.lostBirds],
  ["REPLACED_BIRDS", (a) => a.replacedBirds],
  ["ENTRY_BIRDS", (a) => a.entryBirds],
  ["HOT_SPOT_BIRDS", (a) => a.hotSpotBirds],
  ["PERCH_FEE_VALUE", (a) => a.perchFee],
  ["ENTRY_FEE_VALUE", (a) => a.entryFee],
  ["HOT_SPOT_VALUE", (a) => a.hotSpotFee],
  ["BETS_VALUE", (a) => a.betsValue],
  ["TRANSFER_DUE", (a) => a.transferDue],
  ["ENTRY_REFUND", (a) => a.entryRefund],
  ["BETS_REFUND", (a) => a.betsRefund],
  ["HOT_SPOT_REFUND", (a) => a.hotSpotRefund],
  ["PERCH_FEE_PAY_VALUE", (a) => a.pay.perchFee],
  ["ENTRY_FEE_PAY_VALUE", (a) => a.pay.entryFee],
  ["BETS_PAY_VALUE", (a) => a.pay.bets],
  ["HOT_SPOT_PAY_VALUE", (a) => a.pay.hotSpot],
  ["ENTRY_REFUND_PAY_VALUE", (a) => -a.pay.entryRefund],
  ["BETS_REFUND_PAY_VALUE", (a) => -a.pay.betsRefund],
  ["HOT_SPOT_REFUND_PAY_VALUE", (a) => -a.pay.hotSpotRefund],
  ["TRANSFER_DUE_PAY_VALUE", (a) => a.pay.transferDue],
  ["WINNER_PAYOUT_PAY_VALUE", (a) => -a.pay.winnerPayout],
  ["TOTAL_PAYMENT_VALUE", (a) => a.totalPayment],
  ["CAPITAL_PRIZE", (a) => a.capitalPrize],
  ["HOT_SPOT_1_PRIZE", (a) => a.hotSpot1Prize],
  ["HOT_SPOT_2_PRIZE", (a) => a.hotSpot2Prize],
  ["HOT_SPOT_3_PRIZE", (a) => a.hotSpot3Prize],
  ["AVG_SPEED_WINNER_PRIZE", (a) => a.avgSpeedPrize],
  ["BETS_PRIZE", (a) => a.betsPrize],
  ["WINNER_PAYOUT_VALUE", (a) => a.winnerPayoutValue],
  ["BALANCE_VALUE", (a) => a.balance],
];

let failures = 0;
const summary: string[] = [];
for (const [evKey, rows] of Object.entries(oracle)) {
  const ev = Number(evKey);
  if (EXCLUDED_EVENTS.has(ev) || (only.size && !only.has(ev)) || rows.length === 0) continue;
  const seasons = await prisma.season.findMany({ where: { eventId: ev }, select: { id: true } });
  if (seasons.length !== 1) { console.log(`event ${ev}: ${seasons.length} seasons — SKIPPED`); failures++; continue; }
  const { accounts } = await seasonAccounts(seasons[0].id);
  const byId = new Map(accounts.map((a) => [a.eventInventoryId, a]));
  const seen = new Set<number>();
  const fieldDiffs: Record<string, number> = {};
  const examples: string[] = [];
  let missing = 0;
  for (const row of rows) {
    const hlId = Number(row.ID_EVENT_INVENTORY);
    const ppId = Number(invMap[hlId] ?? hlId);
    const acc = byId.get(ppId);
    if (!acc) { missing++; if (examples.length < 8) examples.push(`registration ${hlId}: not in Pigeon Pulse`); continue; }
    seen.add(ppId);
    for (const [f, get] of FIELDS) {
      const want = n(row[f]), got = get(acc);
      if (Math.abs(want - got) >= 0.005) {
        fieldDiffs[f] = (fieldDiffs[f] ?? 0) + 1;
        if (examples.length < 8) examples.push(`registration ${hlId}${ppId !== hlId ? `→${ppId}` : ""} ${f}: hayloft ${want} · pigeon pulse ${got}`);
      }
    }
  }
  const extra = accounts.filter((a) => !seen.has(a.eventInventoryId));
  const sumBal = (xs: number[]) => Math.round(xs.reduce((s, v) => s + v, 0) * 100) / 100;
  const hlBal = sumBal(rows.map((r) => n(r.BALANCE_VALUE)));
  const ppBal = sumBal(accounts.filter((a) => seen.has(a.eventInventoryId)).map((a) => a.balance));
  const bad = Object.keys(fieldDiffs).length || missing || extra.length;
  if (bad) {
    failures++;
    console.log(`\n### event ${ev} season ${seasons[0].id}: ${rows.length} registrations`);
    if (Object.keys(fieldDiffs).length) console.log("   fields differing (registrations):", JSON.stringify(fieldDiffs));
    if (missing) console.log(`   in HayLoft, not in Pigeon Pulse: ${missing}`);
    if (extra.length) console.log(`   in Pigeon Pulse, not in HayLoft: ${extra.map((a) => a.eventInventoryId).join(",")}`);
    for (const e of examples) console.log("   " + e);
  }
  summary.push(`event ${String(ev).padStart(2)}: ${rows.length} registrations, balance hayloft ${hlBal} · pigeon pulse ${ppBal} — ${bad ? "DIFFERS" : "all fields match"}`);
}
console.log("\n## Summary\n" + summary.join("\n"));
await prisma.$disconnect();
process.exit(failures ? 1 : 0);
