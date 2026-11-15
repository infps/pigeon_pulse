/**
 * A registration's account, computed exactly as HayLoft computes it.
 *
 * HayLoft is the system of record for the books. This is a line-by-line port
 * of its stored procedure EVENT_INVENTORY_GET — the procedure behind its
 * registration list, its Details screen and each breeder's BALANCE_VALUE — and
 * the procedures it calls:
 *
 *   PAYMENT_CALC                 payments by type, and their total
 *   INVENTORY_BETS_CALC          what a registration's class bets cost
 *   WINNER_PRIZE_PAYOUT_BIRD_GET prizes won per bird
 *   EVENT_BET_TOTALS             class-bet pools after commission
 *   RACE_BETS_CALC               who wins the class-bet pools in the final race
 *
 * HayLoft's quirks are kept on purpose, because the figures must be HayLoft's:
 *   - INVENTORY_BETS_CALC leaves WTA 5 out of a registration's bets total;
 *   - the prize total leaves out Hot Spot 3;
 *   - RACE_BETS_CALC never pays Belgian Show 7 (it empties the pool first), and
 *     a Standard Show place with no percentage reuses the last one looked up.
 *
 * Arithmetic is done in ten-thousandths, as Firebird's NUMERIC(15,4): a value
 * is rounded when its scale drops back to 4, and NUMERIC ÷ integer truncates.
 *
 * Portal additions, which are zero for anything imported from HayLoft: race
 * fees, pool-bet stakes charged on the registration, payment types 9 (other)
 * and 10 (registration), approval (an unapproved registration is charged
 * nothing), and soft-deleted entries (not charged or counted).
 *
 * Checked against HayLoft itself: scripts/hayloft-sync/reconcile-accounts.ts
 * compares every field for every registration with the procedure's own output.
 */

import { prisma } from "@/lib/prisma";
import { hotspotOwedFor } from "@/lib/paymentStatus";
import { openHotspotGate } from "@/lib/hotspot-gates";
import { PAYMENT_TYPE } from "@/lib/payment-types";

// ---------------------------------------------------------------- arithmetic

/** Ten-thousandths: Firebird NUMERIC(15,4) as an integer. */
type U = number;
const SCALE = 10_000;
const toU = (v: number | null | undefined): U => (v == null ? 0 : Math.round(v * SCALE));
const fromU = (u: U): number => u / SCALE;
/** Round half away from zero, as Firebird does when a scale is reduced. */
const roundHalfAway = (x: number) => (x < 0 ? -Math.round(-x) : Math.round(x));
/** NUMERIC(15,4) × NUMERIC(15,4) ÷ 100, assigned back to NUMERIC(15,4). */
const mulPctU = (a: U, pctU: U): U => roundHalfAway((a * pctU) / (SCALE * 100));
/** NUMERIC(15,4) ÷ integer: Firebird keeps scale 4 and truncates. */
const divIntU = (a: U, n: number): U => Math.trunc(a / n);

// ---------------------------------------------------------------- race types

/** HayLoft RACE_TYPE ids that carry money. */
export const RACE_TYPE = { FINAL: 5, HOT_SPOT_1: 6, HOT_SPOT_2: 7, HOT_SPOT_3: 8 } as const;

// ---------------------------------------------------------------- class bets

const BELGIAN = [1, 2, 3, 4, 5, 6, 7] as const;
const STANDARD = [1, 2, 3, 4, 5, 6] as const;
const WTA = [1, 2, 3, 4, 5] as const;

type Flags = Record<string, number | null | undefined>;
type Scheme = Record<string, number | null | undefined> & {
  bettingCutPercent?: number | null;
  standardShowPercentages?: Array<{ place: number | null; percValue: number | null }>;
};

const flag = (item: Flags, kind: "belgianShowBet" | "standardShowBet" | "wtaBet", n: number) =>
  item[`${kind}${n}`] ?? null;
const price = (s: Scheme, kind: "belgianShow" | "standardShow" | "wta", n: number) =>
  s[`${kind}${n}`] ?? null;

/** IS_BET_ACTIVE <> 0. A portal entry that never set it is active (HayLoft creates entries with 1). */
const isActive = (item: { isBetActive?: number | null }) => item.isBetActive == null || item.isBetActive !== 0;

/** INVENTORY_BETS_CALC: Σ flag × price over the registration's entries. WTA 5 is not in HayLoft's total. */
export function inventoryBetsU(items: Flags[], s: Scheme | null): U {
  if (!s) return 0;
  let total = 0;
  for (const it of items) {
    for (const n of BELGIAN) total += prod(flag(it, "belgianShowBet", n), price(s, "belgianShow", n));
    for (const n of STANDARD) total += prod(flag(it, "standardShowBet", n), price(s, "standardShow", n));
    for (const n of [1, 2, 3, 4]) total += prod(flag(it, "wtaBet", n), price(s, "wta", n));
  }
  return total;
}
/** One bird's share of INVENTORY_BETS_CALC, in dollars (for invoice lines). */
export function itemBetsValue(item: object, s: object | null): number {
  return fromU(inventoryBetsU([item as Flags], s as Scheme | null));
}

function prod(f: number | null, p: number | null): U {
  return f == null || p == null ? 0 : toU(f * p);
}

/** EVENT_BET_TOTALS: each class's pool, from active entries, less the betting cut. null = no pool. */
function eventBetPools(items: Flags[], s: Scheme): Record<string, U | null> {
  const pools: Record<string, U | null> = {};
  const cutU = toU(s.bettingCutPercent ?? null);
  const add = (key: string, kind: "belgianShowBet" | "standardShowBet" | "wtaBet", pk: "belgianShow" | "standardShow" | "wta", n: number) => {
    let count: number | null = null;
    for (const it of items) {
      if (!isActive(it as { isBetActive?: number | null })) continue;
      const f = flag(it, kind, n);
      if (f != null) count = (count ?? 0) + f;
    }
    const p = price(s, pk, n);
    if (count == null || p == null) { pools[key] = null; return; }
    const total = toU(p) * count;
    pools[key] = s.bettingCutPercent == null ? null : total - mulPctU(total, cutU);
  };
  for (const n of BELGIAN) add(`B${n}`, "belgianShowBet", "belgianShow", n);
  for (const n of STANDARD) add(`S${n}`, "standardShowBet", "standardShow", n);
  for (const n of WTA) add(`W${n}`, "wtaBet", "wta", n);
  return pools;
}

export interface FinalRaceEntry {
  raceItemId: number;
  inventoryItemId: number;
  position: number | null;
  arrivalTime: Date | null;
  drop: number | null;
  item: Flags & { isBetActive?: number | null };
}

/**
 * RACE_BETS_CALC: class-bet winnings per race entry of the final race.
 * `eventItems` are all the event's entries (they make the pools).
 */
export function raceBetWinningsU(
  finalEntries: FinalRaceEntry[],
  eventItems: Flags[],
  s: Scheme
): Map<number, { inventoryItemId: number; total: U }> {
  const pools = eventBetPools(eventItems, s);
  const pct = new Map<number, number | null>();
  for (const p of s.standardShowPercentages ?? []) if (p.place != null) pct.set(p.place, p.percValue);

  const restS: Record<number, U | null> = {};
  const place: Record<number, number> = {};
  for (const n of STANDARD) { restS[n] = pools[`S${n}`]; place[n] = 1; }
  const totalB: Record<number, U | null> = {};
  for (const n of BELGIAN) totalB[n] = pools[`B${n}`];
  const totalW: Record<number, U | null> = {};
  for (const n of WTA) totalW[n] = pools[`W${n}`];
  // SSP_PERCENT is one variable for the whole procedure: a place with no row keeps the last value.
  let ssp: number | null = null;

  // order by BIRD_POSITION nulls last, ARRIVAL_TIME, BIRD_DROP (then id: the table's natural order)
  const ordered = [...finalEntries].sort((a, b) => {
    if (a.position == null && b.position != null) return 1;
    if (a.position != null && b.position == null) return -1;
    if (a.position != null && b.position != null && a.position !== b.position) return a.position - b.position;
    const at = a.arrivalTime?.getTime() ?? Number.POSITIVE_INFINITY;
    const bt = b.arrivalTime?.getTime() ?? Number.POSITIVE_INFINITY;
    if (at !== bt) return at - bt;
    const ad = a.drop ?? Number.POSITIVE_INFINITY, bd = b.drop ?? Number.POSITIVE_INFINITY;
    if (ad !== bd) return ad - bd;
    return a.raceItemId - b.raceItemId;
  });

  type Row = { raceItemId: number; inventoryItemId: number; drop: number | null; v: Record<string, U | null> };
  const rows: Row[] = [];
  for (const e of ordered) {
    const active = isActive(e.item);
    const placed = e.position != null;
    const v: Record<string, U | null> = {};

    for (const n of BELGIAN) {
      v[`B${n}`] = null;
      const value = price(s, "belgianShow", n);
      if (active && placed && value != null && flag(e.item, "belgianShowBet", n) === 1) {
        if (n === 7) { totalB[7] = 0; continue; } // HayLoft: Belgian 7's pool is zeroed before it is checked
        v[`B${n}`] = 0;
        const t = totalB[n];
        if (t != null && t > 0) {
          let pay = toU(value) * 10;
          if (pay > t) { pay = t; totalB[n] = 0; } else totalB[n] = t - pay;
          v[`B${n}`] = pay;
        }
      }
    }

    for (const n of STANDARD) {
      v[`S${n}`] = null;
      if (active && placed && flag(e.item, "standardShowBet", n) === 1) {
        v[`S${n}`] = 0;
        const rest = restS[n];
        if (rest != null && rest > 0) {
          if (pct.has(place[n])) ssp = pct.get(place[n]) ?? null;
          place[n] += 1;
          const total = pools[`S${n}`];
          const pay: U | null = ssp == null || total == null ? null : mulPctU(total, toU(ssp));
          if (pay != null && pay > rest) { v[`S${n}`] = rest; restS[n] = 0; }
          else { v[`S${n}`] = pay; restS[n] = pay == null ? null : rest - pay; }
        }
      }
    }

    for (const n of WTA) {
      v[`W${n}`] = null;
      if (active && placed && flag(e.item, "wtaBet", n) === 1) {
        v[`W${n}`] = 0;
        const t = totalW[n];
        if (t != null && t > 0) { v[`W${n}`] = t; totalW[n] = 0; }
      }
    }
    rows.push({ raceItemId: e.raceItemId, inventoryItemId: e.inventoryItemId, drop: e.drop, v });
  }

  // Birds in the same drop share each class's winnings equally.
  const keys = [...BELGIAN.map((n) => `B${n}`), ...STANDARD.map((n) => `S${n}`), ...WTA.map((n) => `W${n}`)];
  for (const k of keys) {
    const byDrop = new Map<number, Row[]>();
    for (const r of rows) {
      if (r.drop == null || r.v[k] == null) continue;
      const g = byDrop.get(r.drop) ?? [];
      g.push(r);
      byDrop.set(r.drop, g);
    }
    for (const g of byDrop.values()) {
      if (g.length < 2) continue;
      const sum = g.reduce((s, r) => s + (r.v[k] ?? 0), 0);
      const each = divIntU(sum, g.length);
      for (const r of g) r.v[k] = each;
    }
  }

  const out = new Map<number, { inventoryItemId: number; total: U }>();
  for (const r of rows) {
    const total = keys.reduce((s, k) => s + (r.v[k] ?? 0), 0);
    out.set(r.raceItemId, { inventoryItemId: r.inventoryItemId, total });
  }
  return out;
}

// ---------------------------------------------------------------- the account

export interface RegistrationAccount {
  eventInventoryId: number;
  breederId: number | null;
  approvalStatus: string;
  isWaiting: boolean;
  reservedBirds: number;
  inLoftBirds: number;
  lostBirds: number;
  replacedBirds: number;
  entryBirds: number;
  hotSpotBirds: number;
  // charges
  perchFee: number;
  entryFee: number;
  hotSpotFee: number;
  betsValue: number;
  transferDue: number;
  /** Portal: race fees and pool-bet stakes charged on this registration. */
  raceFee: number;
  poolStakes: number;
  // refunds set on the entries
  entryRefund: number;
  betsRefund: number;
  hotSpotRefund: number;
  // payments (PAYMENT_CALC), as stored: money out is negative
  pay: {
    perchFee: number; entryFee: number; bets: number; hotSpot: number;
    entryRefund: number; betsRefund: number; hotSpotRefund: number;
    transferDue: number; winnerPayout: number;
    other: number; registration: number;
  };
  totalPayment: number;
  // prizes (WINNER_PRIZE_PAYOUT_BIRD_GET) and class-bet winnings (RACE_BETS_CALC)
  capitalPrize: number;
  hotSpot1Prize: number;
  hotSpot2Prize: number;
  hotSpot3Prize: number;
  avgSpeedPrize: number;
  betsPrize: number;
  /** What HayLoft owes the breeder: capital + HS1 + HS2 + average + bet winnings (not HS3). */
  winnerPayoutValue: number;
  /** HayLoft BALANCE_VALUE: positive, the breeder owes; negative, the breeder is owed. */
  balance: number;
  /** What each bird won, for prize statements. Only birds that won something. */
  birdPrizes: Array<{
    inventoryItemId: number;
    capital: number;
    hotSpot1: number;
    hotSpot2: number;
    avgSpeed: number;
    bets: number;
  }>;
}

export interface SeasonAccounts {
  seasonId: number;
  feesCutPercent: number;
  bettingCutPercent: number;
  hasFinalRace: boolean;
  accounts: RegistrationAccount[];
}

/** Every registration's account for a season (or the ones asked for). */
export async function seasonAccounts(
  seasonId: number,
  opts: { inventoryIds?: number[] } = {}
): Promise<SeasonAccounts> {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: {
      id: true,
      feeScheme: { select: { feesCutPercent: true } },
      bettingScheme: {
        select: {
          bettingCutPercent: true,
          belgianShow1: true, belgianShow2: true, belgianShow3: true, belgianShow4: true,
          belgianShow5: true, belgianShow6: true, belgianShow7: true,
          standardShow1: true, standardShow2: true, standardShow3: true,
          standardShow4: true, standardShow5: true, standardShow6: true,
          wta1: true, wta2: true, wta3: true, wta4: true, wta5: true,
          standardShowPercentages: { select: { place: true, percValue: true } },
        },
      },
    },
  });
  if (!season) throw new Error(`Season ${seasonId} not found`);
  const scheme = season.bettingScheme as Scheme | null;
  const openGate = await openHotspotGate(seasonId);

  const itemSelect = {
    id: true, birdId: true, deletedAt: true, replacedItemId: true, isBetActive: true,
    perchFeeValue: true, entryFeeValue: true, hotSpotFeeValue: true, raceFeeValue: true,
    hotSpot1FeeValue: true, hotSpot2FeeValue: true, hotSpot3FeeValue: true, hotSpotFinalFeeValue: true,
    entryRefund: true, betsRefund: true, hotSpotRefund: true, transferDue: true,
    belgianShowBet1: true, belgianShowBet2: true, belgianShowBet3: true, belgianShowBet4: true,
    belgianShowBet5: true, belgianShowBet6: true, belgianShowBet7: true,
    standardShowBet1: true, standardShowBet2: true, standardShowBet3: true,
    standardShowBet4: true, standardShowBet5: true, standardShowBet6: true,
    wtaBet1: true, wtaBet2: true, wtaBet3: true, wtaBet4: true, wtaBet5: true,
    bird: { select: { isLost: true } },
  } as const;

  // Full detail for the registrations asked for (all of them by default).
  const wanted = opts.inventoryIds ? new Set(opts.inventoryIds) : null;
  const registrations = await prisma.eventInventory.findMany({
    where: { seasonId, ...(wanted ? { id: { in: [...wanted] } } : {}) },
    select: {
      id: true, breederId: true, approvalStatus: true, isWaiting: true, reservedBirds: true,
      hotspotsPaidMask: true,
      items: { select: itemSelect },
      payments: { where: { status: "PAID" }, select: { id: true, paymentType: true, paymentValue: true } },
    },
  });

  const ownItems = registrations.flatMap((r) => r.items);
  const raceItemSelect = {
    id: true,
    inventoryItemId: true,
    race: { select: { raceTypeId: true } },
    result: { select: { birdPosition: true, arrivalTime: true, birdDrop: true, prizeValue: true } },
  } as const;
  // Prize races, for the entries being reported on.
  const finalAndHotSpots = await prisma.raceItem.findMany({
    where: {
      race: { seasonId, raceTypeId: { in: [RACE_TYPE.FINAL, RACE_TYPE.HOT_SPOT_1, RACE_TYPE.HOT_SPOT_2, RACE_TYPE.HOT_SPOT_3] } },
      inventoryItemId: wanted ? { in: ownItems.map((i) => i.id) } : { not: null },
    },
    select: raceItemSelect,
  });
  const hasFinalRace = (await prisma.race.count({ where: { seasonId, raceTypeId: RACE_TYPE.FINAL } })) > 0;

  // The class-bet pools and the final race's finishing order involve every
  // entry of the event, whoever is being reported on.
  const betSelect = Object.fromEntries(
    Object.entries(itemSelect).filter(([k]) => k === "id" || k === "isBetActive" || /Bet\d$/.test(k))
  ) as { id: true; isBetActive: true };
  const allItems = wanted && hasFinalRace && scheme
    ? await prisma.eventInventoryItem.findMany({ where: { eventInventory: { seasonId } }, select: betSelect })
    : ownItems;
  const itemById = new Map<number, (typeof allItems)[number]>(allItems.map((i) => [i.id, i]));
  const finalRaceItems = wanted && hasFinalRace && scheme
    ? await prisma.raceItem.findMany({
        where: { race: { seasonId, raceTypeId: RACE_TYPE.FINAL }, inventoryItemId: { not: null } },
        select: raceItemSelect,
      })
    : finalAndHotSpots;

  // Prizes per entry, by race type (WINNER_PRIZE_PAYOUT_BIRD_GET).
  const prizeByItem = new Map<number, Record<number, number | null>>();
  for (const ri of finalAndHotSpots) {
    const t = ri.race?.raceTypeId;
    if (t == null || ri.inventoryItemId == null || !ri.result) continue;
    const rec = prizeByItem.get(ri.inventoryItemId) ?? {};
    rec[t] = ri.result.prizeValue;
    prizeByItem.set(ri.inventoryItemId, rec);
  }
  const avg = await prisma.avgWinnerPrizes.findMany({
    where: { inventoryItemId: { in: ownItems.map((i) => i.id) } },
    select: { inventoryItemId: true, prizeValue: true },
  });
  const avgByItem = new Map(avg.map((a) => [a.inventoryItemId, a.prizeValue]));

  // Class-bet winnings in the final race (only when the event has one).
  const betsPrizeByItem = new Map<number, U>();
  if (hasFinalRace && scheme) {
    const finalEntries: FinalRaceEntry[] = finalRaceItems
      .filter((ri) => ri.race?.raceTypeId === RACE_TYPE.FINAL && ri.inventoryItemId != null && itemById.has(ri.inventoryItemId))
      .map((ri) => ({
        raceItemId: ri.id,
        inventoryItemId: ri.inventoryItemId as number,
        position: ri.result?.birdPosition ?? null,
        arrivalTime: ri.result?.arrivalTime ?? null,
        drop: ri.result?.birdDrop ?? null,
        item: itemById.get(ri.inventoryItemId as number) as unknown as FinalRaceEntry["item"],
      }));
    const wins = raceBetWinningsU(finalEntries, allItems as unknown as Flags[], scheme);
    for (const w of wins.values()) betsPrizeByItem.set(w.inventoryItemId, (betsPrizeByItem.get(w.inventoryItemId) ?? 0) + w.total);
  }

  // Pool-bet stakes charged on a registration's payments (portal).
  const paymentIds = registrations.flatMap((r) => r.payments.map((p) => p.id));
  const stakes = paymentIds.length
    ? await prisma.bet.findMany({ where: { stakePaymentId: { in: paymentIds } }, select: { stakePaymentId: true, amount: true } })
    : [];
  const stakeByPayment = new Map<number, number>();
  for (const s of stakes) if (s.stakePaymentId != null) stakeByPayment.set(s.stakePaymentId, (stakeByPayment.get(s.stakePaymentId) ?? 0) + s.amount);

  const accounts: RegistrationAccount[] = [];
  for (const reg of registrations) {
    const billable = reg.approvalStatus === "APPROVED";
    const live = reg.items.filter((i) => i.deletedAt == null);
    const sumU = (f: (i: (typeof live)[number]) => number | null | undefined) =>
      live.reduce((s, i) => s + toU(f(i)), 0);

    const perch = sumU((i) => i.perchFeeValue);
    const entry = sumU((i) => i.entryFeeValue);
    const hotSpot = live.reduce((s, i) => s + toU(hotspotOwedFor(i, reg.hotspotsPaidMask, openGate)), 0);
    const raceFee = sumU((i) => i.raceFeeValue);
    const betsValue = inventoryBetsU(live as unknown as Flags[], scheme);
    const transfer = sumU((i) => i.transferDue);
    const entryRefund = sumU((i) => i.entryRefund);
    const betsRefund = sumU((i) => i.betsRefund);
    const hsRefund = sumU((i) => i.hotSpotRefund);

    const payBy = (t: number) => reg.payments.filter((p) => p.paymentType === t).reduce((s, p) => s + toU(p.paymentValue), 0);
    const untyped = reg.payments.filter((p) => p.paymentType == null).reduce((s, p) => s + toU(p.paymentValue), 0);
    const pay = {
      perchFee: payBy(PAYMENT_TYPE.PERCH_FEE), entryFee: payBy(PAYMENT_TYPE.ENTRY_FEE),
      bets: payBy(PAYMENT_TYPE.BETS), hotSpot: payBy(PAYMENT_TYPE.HOT_SPOT),
      entryRefund: payBy(PAYMENT_TYPE.ENTRY_REFUND), betsRefund: payBy(PAYMENT_TYPE.BETS_REFUND),
      hotSpotRefund: payBy(PAYMENT_TYPE.HOT_SPOT_REFUND), transferDue: payBy(PAYMENT_TYPE.TRANSFER_DUE),
      winnerPayout: payBy(PAYMENT_TYPE.WINNER_PAYOUT),
      other: payBy(PAYMENT_TYPE.OTHER), registration: payBy(PAYMENT_TYPE.REGISTRATION) + untyped,
    };
    // PAYMENT_CALC's total is the plain sum of every payment (money out is stored negative).
    const totalPayment = Object.values(pay).reduce((s, v) => s + v, 0);
    const poolStakes = reg.payments.reduce((s, p) => s + toU(stakeByPayment.get(p.id) ?? 0), 0);

    // Prizes: only entries with a bird (WINNER_PRIZE_PAYOUT_GET joins BIRDS).
    let capital = 0, hs1 = 0, hs2 = 0, hs3 = 0, avgP = 0, betsPrize = 0, anyBird = false;
    const birdPrizes: RegistrationAccount["birdPrizes"] = [];
    for (const i of reg.items) {
      const b = betsPrizeByItem.get(i.id) ?? 0;
      betsPrize += b;
      if (i.birdId == null) continue;
      anyBird = true;
      const p = prizeByItem.get(i.id) ?? {};
      const c = toU(p[RACE_TYPE.FINAL]), h1 = toU(p[RACE_TYPE.HOT_SPOT_1]), h2 = toU(p[RACE_TYPE.HOT_SPOT_2]);
      const a = toU(avgByItem.get(i.id) ?? null);
      capital += c;
      hs1 += h1;
      hs2 += h2;
      hs3 += toU(p[RACE_TYPE.HOT_SPOT_3]);
      avgP += a;
      if (billable && (c || h1 || h2 || a || b)) {
        birdPrizes.push({
          inventoryItemId: i.id,
          capital: fromU(c), hotSpot1: fromU(h1), hotSpot2: fromU(h2), avgSpeed: fromU(a), bets: fromU(b),
        });
      }
    }
    // sum(PRIZE_TOTAL) is null for a registration with no birds, and null + bets prize stays null.
    const winnerPayout = anyBird ? capital + hs1 + hs2 + avgP + betsPrize : 0;

    const charges = billable ? perch + entry + hotSpot + raceFee + betsValue + transfer + poolStakes : 0;
    const refunds = billable ? entryRefund + betsRefund + hsRefund : 0;
    const owedOut = billable ? winnerPayout : 0;
    const balance = charges - refunds - owedOut - totalPayment;

    accounts.push({
      eventInventoryId: reg.id,
      breederId: reg.breederId,
      approvalStatus: reg.approvalStatus,
      isWaiting: reg.isWaiting === 1 || reg.approvalStatus === "WAITING",
      reservedBirds: reg.reservedBirds ?? 0,
      inLoftBirds: live.filter((i) => i.replacedItemId == null).length,
      lostBirds: live.filter((i) => i.bird?.isLost === 1).length,
      replacedBirds: live.filter((i) => i.replacedItemId != null).length,
      entryBirds: live.filter((i) => (i.entryFeeValue ?? 0) > 0 && (i.entryRefund ?? 0) === 0).length,
      hotSpotBirds: live.filter((i) => (i.hotSpotFeeValue ?? 0) > 0).length,
      perchFee: fromU(billable ? perch : 0),
      entryFee: fromU(billable ? entry : 0),
      hotSpotFee: fromU(billable ? hotSpot : 0),
      betsValue: fromU(billable ? betsValue : 0),
      transferDue: fromU(billable ? transfer : 0),
      raceFee: fromU(billable ? raceFee : 0),
      poolStakes: fromU(billable ? poolStakes : 0),
      entryRefund: fromU(billable ? entryRefund : 0),
      betsRefund: fromU(billable ? betsRefund : 0),
      hotSpotRefund: fromU(billable ? hsRefund : 0),
      pay: Object.fromEntries(Object.entries(pay).map(([k, v]) => [k, fromU(v)])) as RegistrationAccount["pay"],
      totalPayment: fromU(totalPayment),
      capitalPrize: fromU(capital),
      hotSpot1Prize: fromU(hs1),
      hotSpot2Prize: fromU(hs2),
      hotSpot3Prize: fromU(hs3),
      avgSpeedPrize: fromU(avgP),
      betsPrize: fromU(betsPrize),
      winnerPayoutValue: fromU(owedOut),
      balance: fromU(balance),
      birdPrizes,
    });
  }

  return {
    seasonId,
    feesCutPercent: season.feeScheme?.feesCutPercent ?? 0,
    bettingCutPercent: season.bettingScheme?.bettingCutPercent ?? 0,
    hasFinalRace,
    accounts,
  };
}
