/**
 * Report pack — the eleven HayLoft FastReport templates, rebuilt.
 *
 * Each definition resolves to a titled table. Rendering to CSV / XLSX / PDF /
 * HTML is the renderer's job, so a report is written once and comes out in
 * every format the office needs.
 */

import { prisma } from "@/lib/prisma";
import type { ReportDefinition, ReportData, ReportParams } from "./types";
import {
  bandOf,
  breederName,
  clockTime,
  date,
  flightMinutes,
  hhmmss,
  money,
  num,
  raceSubtitle,
  seasonSubtitle,
  speedYPM,
} from "./helpers";

function requireParam(params: ReportParams, key: keyof ReportParams): number {
  const value = params[key];
  if (value == null) throw new Error(`This report requires a ${key}.`);
  return value;
}

/* ------------------------------------------------------------------ *
 * race_result.fr3 — the race sheet
 * ------------------------------------------------------------------ */
async function buildRaceResult(params: ReportParams): Promise<ReportData> {
  const raceId = requireParam(params, "raceId");

  const race = await prisma.race.findUnique({
    where: { id: raceId },
    select: {
      startTime: true,
      distance: true,
      raceStation: { select: { miles: true } },
    },
  });

  const items = await prisma.raceItem.findMany({
    where: { raceId, result: { isNot: null } },
    select: {
      isLost: true,
      result: {
        select: {
          birdPosition: true,
          birdPositionHotSpot: true,
          arrivalTime: true,
          birdDrop: true,
          prizeValue: true,
        },
      },
      inventoryItem: {
        select: {
          bird: {
            select: {
              band1: true, band2: true, band3: true, band4: true, band: true,
              color: true, sex: true, birdName: true,
            },
          },
          eventInventory: {
            select: { loft: true, breeder: { select: { firstName: true, lastName: true } } },
          },
        },
      },
    },
  });

  const distanceMiles = race?.raceStation?.miles ?? race?.distance ?? null;

  // Placed birds first in finishing order, then everything else by arrival.
  const sorted = [...items].sort((a, b) => {
    const pa = a.result?.birdPosition ?? Number.MAX_SAFE_INTEGER;
    const pb = b.result?.birdPosition ?? Number.MAX_SAFE_INTEGER;
    if (pa !== pb) return pa - pb;
    const ta = a.result?.arrivalTime?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const tb = b.result?.arrivalTime?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return ta - tb;
  });

  let prizeTotal = 0;
  const rows = sorted.map((item) => {
    const r = item.result!;
    const minutes = flightMinutes(race?.startTime ?? null, r.arrivalTime);
    const speed = speedYPM(distanceMiles, minutes);
    prizeTotal += r.prizeValue ?? 0;

    return [
      r.birdPosition != null ? String(r.birdPosition) : "",
      r.birdPositionHotSpot != null ? String(r.birdPositionHotSpot) : "",
      bandOf(item.inventoryItem?.bird),
      item.inventoryItem?.bird?.birdName ?? "",
      item.inventoryItem?.bird?.color ?? "",
      breederName(item.inventoryItem?.eventInventory?.breeder),
      item.inventoryItem?.eventInventory?.loft ?? "",
      r.arrivalTime ? clockTime(r.arrivalTime) : "",
      hhmmss(minutes),
      speed != null ? num(speed, 2) : "",
      r.birdDrop != null ? String(r.birdDrop) : "",
      item.isLost === 1 ? "Lost" : "",
      money(r.prizeValue),
    ];
  });

  return {
    title: "Race Result",
    subtitle: await raceSubtitle(raceId),
    columns: [
      "Pos", "HS", "Band", "Name", "Color", "Breeder", "Loft",
      "Arrival", "Flight", "Speed (ypm)", "Drop", "Status", "Prize",
    ],
    rows,
    totals: ["", "", "", "", "", "", "", "", "", "", "", "Total", money(prizeTotal)],
    numericColumns: [0, 1, 7, 8, 9, 10, 12],
  };
}

/* ------------------------------------------------------------------ *
 * breeder_avg_report.fr3 / breeder_avg_short_report.fr3
 * ------------------------------------------------------------------ */
async function buildBreederAverage(params: ReportParams, short: boolean): Promise<ReportData> {
  const seasonId = requireParam(params, "seasonId");

  const races = await prisma.race.findMany({
    where: { seasonId },
    select: {
      id: true,
      startTime: true,
      distance: true,
      raceStation: { select: { miles: true } },
    },
  });
  const raceById = new Map(races.map((r) => [r.id, r]));

  const items = await prisma.eventInventoryItem.findMany({
    where: { eventInventory: { seasonId } },
    select: {
      eventInventory: {
        select: {
          loft: true,
          breeder: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      raceItems: {
        where: { result: { arrivalTime: { not: null } } },
        select: { raceId: true, result: { select: { arrivalTime: true } } },
      },
    },
  });

  interface Agg {
    breeder: string;
    loft: string;
    birds: number;
    races: number;
    miles: number;
    minutes: number;
  }
  const byBreeder = new Map<number, Agg>();

  for (const item of items) {
    const breeder = item.eventInventory?.breeder;
    if (!breeder) continue;

    let birdMiles = 0;
    let birdMinutes = 0;
    let birdRaces = 0;

    for (const ri of item.raceItems) {
      const race = raceById.get(ri.raceId ?? -1);
      if (!race) continue;
      const miles = race.raceStation?.miles ?? race.distance ?? 0;
      const minutes = flightMinutes(race.startTime, ri.result?.arrivalTime ?? null);
      if (!miles || minutes == null) continue;
      birdMiles += miles;
      birdMinutes += minutes;
      birdRaces++;
    }

    const agg = byBreeder.get(breeder.id) ?? {
      breeder: breederName(breeder),
      loft: item.eventInventory?.loft ?? "",
      birds: 0,
      races: 0,
      miles: 0,
      minutes: 0,
    };
    agg.birds++;
    agg.races += birdRaces;
    agg.miles += birdMiles;
    agg.minutes += birdMinutes;
    byBreeder.set(breeder.id, agg);
  }

  const ranked = [...byBreeder.values()]
    .map((a) => ({ ...a, speed: speedYPM(a.miles, a.minutes) }))
    .sort((a, b) => (b.speed ?? -1) - (a.speed ?? -1));

  const rows = ranked.map((a, i) => {
    const rank = String(i + 1);
    if (short) {
      return [rank, a.breeder, a.loft, String(a.birds), a.speed != null ? num(a.speed, 2) : ""];
    }
    return [
      rank,
      a.breeder,
      a.loft,
      String(a.birds),
      String(a.races),
      num(a.miles, 1),
      hhmmss(a.minutes || null),
      a.speed != null ? num(a.speed, 2) : "",
    ];
  });

  return {
    title: short ? "Breeder Average (Short)" : "Breeder Average",
    subtitle: await seasonSubtitle(seasonId),
    columns: short
      ? ["Rank", "Breeder", "Loft", "Birds", "Avg Speed (ypm)"]
      : ["Rank", "Breeder", "Loft", "Birds", "Races Flown", "Miles", "Total Time", "Avg Speed (ypm)"],
    rows,
    numericColumns: short ? [0, 3, 4] : [0, 3, 4, 5, 6, 7],
  };
}

/* ------------------------------------------------------------------ *
 * inventory_item_balance.fr3 — money owed per breeder
 * ------------------------------------------------------------------ */
async function buildBreederBalance(params: ReportParams): Promise<ReportData> {
  const seasonId = requireParam(params, "seasonId");

  const inventories = await prisma.eventInventory.findMany({
    where: { seasonId },
    select: {
      loft: true,
      cashPromised: true,
      breeder: { select: { firstName: true, lastName: true } },
      items: {
        select: {
          entryFeeValue: true,
          perchFeeValue: true,
          hotSpotFeeValue: true,
          raceFeeValue: true,
          entryRefund: true,
          hotSpotRefund: true,
          betsRefund: true,
        },
      },
      payments: { select: { paymentValue: true, status: true } },
    },
  });

  let tCharged = 0;
  let tRefund = 0;
  let tPaid = 0;
  let tBalance = 0;

  const rows = inventories.map((inv) => {
    const charged = inv.items.reduce(
      (s, it) =>
        s +
        (it.entryFeeValue ?? 0) +
        (it.perchFeeValue ?? 0) +
        (it.hotSpotFeeValue ?? 0) +
        (it.raceFeeValue ?? 0),
      0
    );
    const refunds = inv.items.reduce(
      (s, it) => s + (it.entryRefund ?? 0) + (it.hotSpotRefund ?? 0) + (it.betsRefund ?? 0),
      0
    );
    const paid = inv.payments
      .filter((p) => p.status === "PAID")
      .reduce((s, p) => s + (p.paymentValue ?? 0), 0);
    const balance = charged - refunds - paid;

    tCharged += charged;
    tRefund += refunds;
    tPaid += paid;
    tBalance += balance;

    return [
      breederName(inv.breeder),
      inv.loft ?? "",
      String(inv.items.length),
      money(charged),
      money(refunds),
      money(paid),
      money(balance),
      balance > 0 ? (inv.cashPromised ? "Cash promised" : "Owing") : "Settled",
    ];
  });

  rows.sort((a, b) => a[0].localeCompare(b[0]));

  return {
    title: "Breeder Balance",
    subtitle: await seasonSubtitle(seasonId),
    columns: ["Breeder", "Loft", "Birds", "Charged", "Refunds", "Paid", "Balance", "Status"],
    rows,
    totals: ["Total", "", "", money(tCharged), money(tRefund), money(tPaid), money(tBalance), ""],
    numericColumns: [2, 3, 4, 5, 6],
  };
}

/* ------------------------------------------------------------------ *
 * inventory_list.fr3 — every bird entered this season
 * ------------------------------------------------------------------ */
async function buildInventoryList(params: ReportParams): Promise<ReportData> {
  const seasonId = requireParam(params, "seasonId");

  const items = await prisma.eventInventoryItem.findMany({
    where: { eventInventory: { seasonId } },
    select: {
      birdNo: true,
      isBackup: true,
      arrivalDate: true,
      bird: {
        select: {
          band1: true, band2: true, band3: true, band4: true, band: true,
          birdName: true, color: true, sex: true, rfid: true, isLost: true,
        },
      },
      eventInventory: {
        select: { loft: true, breeder: { select: { firstName: true, lastName: true } } },
      },
      currentGroup: { select: { name: true } },
    },
    orderBy: { id: "asc" },
  });

  const SEX: Record<number, string> = { 0: "Unknown", 1: "Cock", 2: "Hen" };

  const rows = items.map((it) => [
    it.birdNo != null ? String(it.birdNo) : "",
    bandOf(it.bird),
    it.bird?.birdName ?? "",
    it.bird?.color ?? "",
    it.bird?.sex != null ? (SEX[it.bird.sex] ?? "") : "",
    it.bird?.rfid ?? "",
    breederName(it.eventInventory?.breeder),
    it.eventInventory?.loft ?? "",
    it.currentGroup?.name ?? "",
    it.isBackup === 1 ? "Backup" : "",
    it.bird?.isLost === 1 ? "Lost" : "",
    date(it.arrivalDate),
  ]);

  return {
    title: "Inventory List",
    subtitle: await seasonSubtitle(seasonId),
    columns: [
      "No", "Band", "Name", "Color", "Sex", "RFID",
      "Breeder", "Loft", "Group", "Backup", "Status", "Received",
    ],
    rows,
    totals: ["", `${rows.length} birds`, "", "", "", "", "", "", "", "", "", ""],
    numericColumns: [0],
  };
}

/* ------------------------------------------------------------------ *
 * pool_totals.fr3 — betting pools for a race
 * ------------------------------------------------------------------ */
async function buildPoolTotals(params: ReportParams): Promise<ReportData> {
  const raceId = requireParam(params, "raceId");

  const race = await prisma.race.findUnique({
    where: { id: raceId },
    select: { seasonRel: { select: { bettingScheme: { select: { bettingCutPercent: true } } } } },
  });
  const cutPercent = race?.seasonRel?.bettingScheme?.bettingCutPercent ?? 0;

  const bets = await prisma.bet.findMany({
    where: { raceId },
    select: { category: true, tierIndex: true, amount: true, status: true, payoutValue: true },
  });

  interface Pool {
    bets: number;
    stake: number;
    payout: number;
    refunded: number;
    won: number;
  }
  const pools = new Map<string, Pool>();

  for (const bet of bets) {
    const key = `${bet.category}|${bet.tierIndex}`;
    const pool = pools.get(key) ?? { bets: 0, stake: 0, payout: 0, refunded: 0, won: 0 };
    pool.bets++;
    pool.stake += bet.amount;
    pool.payout += bet.payoutValue ?? 0;
    if (bet.status === "REFUNDED") pool.refunded++;
    if (bet.status === "WON" || bet.status === "PAID") pool.won++;
    pools.set(key, pool);
  }

  let tBets = 0;
  let tStake = 0;
  let tCut = 0;
  let tPayout = 0;

  const rows = [...pools.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, pool]) => {
      const [category, tier] = key.split("|");
      const cut = pool.stake * (cutPercent / 100);
      tBets += pool.bets;
      tStake += pool.stake;
      tCut += cut;
      tPayout += pool.payout;

      return [
        category,
        tier,
        String(pool.bets),
        money(pool.stake),
        money(cut),
        money(pool.stake - cut),
        String(pool.won),
        String(pool.refunded),
        money(pool.payout),
      ];
    });

  return {
    title: "Pool Totals",
    subtitle: await raceSubtitle(raceId),
    columns: [
      "Category", "Tier", "Bets", "Stake In", `House Cut (${num(cutPercent, 2)}%)`,
      "Distributable", "Winners", "Refunded", "Paid Out",
    ],
    rows,
    totals: [
      "Total", "", String(tBets), money(tStake), money(tCut),
      money(tStake - tCut), "", "", money(tPayout),
    ],
    numericColumns: [2, 3, 4, 5, 6, 7, 8],
  };
}

/* ------------------------------------------------------------------ *
 * fee_scheme.fr3
 * ------------------------------------------------------------------ */
async function buildFeeScheme(params: ReportParams): Promise<ReportData> {
  const fromSeason = params.seasonId
    ? (
        await prisma.season.findUnique({
          where: { id: params.seasonId },
          select: { feeSchemeId: true },
        })
      )?.feeSchemeId ?? null
    : null;
  const schemeId = params.feeSchemeId ?? fromSeason;

  if (schemeId == null) {
    throw new Error("This report requires a fee scheme, or a season that has one assigned.");
  }

  const scheme = await prisma.feeScheme.findUnique({
    where: { id: schemeId },
    select: {
      name: true, entryFee: true, maxBirdCount: true, maxBackupBirdCount: true,
      isFloatingBackup: true, isRefundable: true, minEntryFees: true, feesCutPercent: true,
      hotSpot1Fee: true, hotSpot2Fee: true, hotSpot3Fee: true, hotSpotFinalFee: true,
      raceFeeMode: true,
      birdFeeItems: { select: { birdNo: true, birdFee: true }, orderBy: { birdNo: "asc" } },
      raceTypeFees: { select: { fee: true, raceType: { select: { name: true } } } },
    },
  });
  if (!scheme) throw new Error("Fee scheme not found.");

  const rows: string[][] = [
    ["Entry (purge) fee", "flat, once per registration", money(scheme.entryFee)],
    ["Maximum birds", "per registration", num(scheme.maxBirdCount)],
    ["Maximum backup birds", "per registration", num(scheme.maxBackupBirdCount)],
    ["Floating backups", "backups flex across registrations", scheme.isFloatingBackup === 1 ? "Yes" : "No"],
    ["Entry fee refundable", "if a bird is scratched", scheme.isRefundable === 1 ? "Yes" : "No"],
    ["Minimum total fee", "regardless of calculation", money(scheme.minEntryFees)],
    ["Admin cut", "percent of fees collected", `${num(scheme.feesCutPercent)}%`],
    [
      "Race fee mode",
      "how race fees multiply",
      scheme.raceFeeMode === "PER_BIRD_PER_RACE" ? "Per bird, per race" : "Flat per race",
    ],
    ["Hot spot 1 fee", "per bird", money(scheme.hotSpot1Fee)],
    ["Hot spot 2 fee", "per bird", money(scheme.hotSpot2Fee)],
    ["Hot spot 3 fee", "per bird", money(scheme.hotSpot3Fee)],
    ["Hot spot final fee", "per bird", money(scheme.hotSpotFinalFee)],
  ];

  for (const item of scheme.birdFeeItems) {
    rows.push([`Perch fee — bird ${item.birdNo ?? "?"}`, "graduated per-bird fee", money(item.birdFee)]);
  }
  for (const rtf of scheme.raceTypeFees) {
    rows.push([`Race fee — ${rtf.raceType?.name ?? "?"}`, "per race type", money(rtf.fee)]);
  }

  return {
    title: `Fee Scheme — ${scheme.name ?? "Unnamed"}`,
    subtitle: params.seasonId ? await seasonSubtitle(params.seasonId) : undefined,
    columns: ["Setting", "Applies", "Value"],
    rows,
    numericColumns: [2],
  };
}

/* ------------------------------------------------------------------ *
 * prize_scheme.fr3
 * ------------------------------------------------------------------ */
async function buildPrizeScheme(params: ReportParams): Promise<ReportData> {
  const fromSeason = params.seasonId
    ? (
        await prisma.season.findUnique({
          where: { id: params.seasonId },
          select: { finalPrizeSchemeId: true },
        })
      )?.finalPrizeSchemeId ?? null
    : null;
  const schemeId = params.prizeSchemeId ?? fromSeason;

  if (schemeId == null) {
    throw new Error("This report requires a prize scheme, or a season with a final prize scheme.");
  }

  const scheme = await prisma.prizeScheme.findUnique({
    where: { id: schemeId },
    select: {
      name: true,
      prizeSchemeItems: {
        select: {
          fromPosition: true,
          toPosition: true,
          prizeValue: true,
          prizeValues: {
            where: params.seasonId ? { seasonId: params.seasonId } : undefined,
            select: { prizeValue: true, raceType: { select: { name: true } } },
          },
        },
        orderBy: { fromPosition: "asc" },
      },
    },
  });
  if (!scheme) throw new Error("Prize scheme not found.");

  let total = 0;
  const rows = scheme.prizeSchemeItems.map((item) => {
    const from = item.fromPosition ?? 0;
    const to = item.toPosition ?? 0;
    const places = Math.max(0, to - from + 1);
    // The season override is what actually pays; the band value is a template.
    const actual = item.prizeValues[0]?.prizeValue ?? null;
    const perPlace = actual ?? item.prizeValue ?? 0;
    total += perPlace * places;

    return [
      from === to ? String(from) : `${from}–${to}`,
      String(places),
      money(item.prizeValue),
      actual != null ? money(actual) : "—",
      item.prizeValues[0]?.raceType?.name ?? "",
      money(perPlace * places),
    ];
  });

  return {
    title: `Prize Scheme — ${scheme.name ?? "Unnamed"}`,
    subtitle: params.seasonId ? await seasonSubtitle(params.seasonId) : undefined,
    columns: ["Positions", "Places", "Template", "Season Value", "Race Type", "Band Total"],
    rows,
    totals: ["Total", "", "", "", "", money(total)],
    numericColumns: [1, 2, 3, 5],
  };
}

/* ------------------------------------------------------------------ *
 * betting_scheme.fr3
 * ------------------------------------------------------------------ */
async function buildBettingScheme(params: ReportParams): Promise<ReportData> {
  const fromSeason = params.seasonId
    ? (
        await prisma.season.findUnique({
          where: { id: params.seasonId },
          select: { bettingSchemeId: true },
        })
      )?.bettingSchemeId ?? null
    : null;
  const schemeId = params.bettingSchemeId ?? fromSeason;

  if (schemeId == null) {
    throw new Error("This report requires a betting scheme, or a season that has one assigned.");
  }

  const scheme = await prisma.bettingScheme.findUnique({
    where: { id: schemeId },
    select: {
      name: true, bettingCutPercent: true, belgianRatio: true,
      belgianShow1: true, belgianShow2: true, belgianShow3: true, belgianShow4: true,
      belgianShow5: true, belgianShow6: true, belgianShow7: true,
      standardShow1: true, standardShow2: true, standardShow3: true,
      standardShow4: true, standardShow5: true, standardShow6: true,
      wta1: true, wta2: true, wta3: true, wta4: true, wta5: true,
      standardShowPercentages: { select: { place: true, percValue: true }, orderBy: { place: "asc" } },
    },
  });
  if (!scheme) throw new Error("Betting scheme not found.");

  const rows: string[][] = [
    ["House cut", "deducted before distribution", `${num(scheme.bettingCutPercent, 2)}%`],
    ["Belgian ratio", "winners = birds / ratio", num(scheme.belgianRatio)],
  ];

  const tiers: Array<[string, Array<number | null | undefined>]> = [
    ["Belgian", [
      scheme.belgianShow1, scheme.belgianShow2, scheme.belgianShow3, scheme.belgianShow4,
      scheme.belgianShow5, scheme.belgianShow6, scheme.belgianShow7,
    ]],
    ["Standard", [
      scheme.standardShow1, scheme.standardShow2, scheme.standardShow3,
      scheme.standardShow4, scheme.standardShow5, scheme.standardShow6,
    ]],
    ["WTA", [scheme.wta1, scheme.wta2, scheme.wta3, scheme.wta4, scheme.wta5]],
  ];

  for (const [label, values] of tiers) {
    values.forEach((value, index) => {
      if (value == null) return;
      rows.push([`${label} show ${index + 1}`, "pool entry price", money(value)]);
    });
  }

  for (const p of scheme.standardShowPercentages) {
    rows.push([`Standard place ${p.place ?? "?"}`, "share of the standard pool", `${num(p.percValue)}%`]);
  }

  return {
    title: `Betting Scheme — ${scheme.name ?? "Unnamed"}`,
    subtitle: params.seasonId ? await seasonSubtitle(params.seasonId) : undefined,
    columns: ["Setting", "Applies", "Value"],
    rows,
    numericColumns: [2],
  };
}

/* ------------------------------------------------------------------ *
 * breeder_labels.fr3 / address_book_labels.fr3
 * ------------------------------------------------------------------ */
const LABEL_FIELDS = {
  firstName: true, lastName: true, address1: true, city1: true,
  state1: true, zip1: true, country: true, phone: true, email: true,
} as const;

async function buildLabels(params: ReportParams, seasonScoped: boolean): Promise<ReportData> {
  const breeders = seasonScoped
    ? await prisma.breeder.findMany({
        where: { eventInventories: { some: { seasonId: requireParam(params, "seasonId") } } },
        select: LABEL_FIELDS,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      })
    : await prisma.breeder.findMany({
        where: { OR: [{ status: 1 }, { status: null }] },
        select: LABEL_FIELDS,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      });

  const rows = breeders.map((b) => [
    breederName(b),
    b.address1 ?? "",
    [b.city1, b.state1].filter(Boolean).join(", "),
    b.zip1 ?? "",
    b.country ?? "",
    b.phone ?? "",
    b.email ?? "",
  ]);

  return {
    title: seasonScoped ? "Breeder Labels" : "Address Book Labels",
    subtitle:
      seasonScoped && params.seasonId
        ? await seasonSubtitle(params.seasonId)
        : `${rows.length} contacts`,
    columns: ["Name", "Address", "City / State", "ZIP", "Country", "Phone", "Email"],
    rows,
  };
}

/* ------------------------------------------------------------------ */

export const REPORTS: ReportDefinition[] = [
  {
    key: "race-result",
    title: "Race Result",
    description: "Finishing order with arrival time, flight time, speed and prize money.",
    legacyTemplate: "race_result.fr3",
    scope: "race",
    requires: "raceId",
    build: (p) => buildRaceResult(p),
  },
  {
    key: "breeder-average",
    title: "Breeder Average",
    description: "Breeders ranked by average speed across the season, with miles and time flown.",
    legacyTemplate: "breeder_avg_report.fr3",
    scope: "season",
    requires: "seasonId",
    build: (p) => buildBreederAverage(p, false),
  },
  {
    key: "breeder-average-short",
    title: "Breeder Average (Short)",
    description: "Condensed average standings — rank, breeder, birds and speed.",
    legacyTemplate: "breeder_avg_short_report.fr3",
    scope: "season",
    requires: "seasonId",
    build: (p) => buildBreederAverage(p, true),
  },
  {
    key: "breeder-balance",
    title: "Breeder Balance",
    description: "Fees charged against payments received, with the outstanding balance per breeder.",
    legacyTemplate: "inventory_item_balance.fr3",
    scope: "season",
    requires: "seasonId",
    build: (p) => buildBreederBalance(p),
  },
  {
    key: "inventory-list",
    title: "Inventory List",
    description: "Every bird entered in the season with band, owner, loft group and status.",
    legacyTemplate: "inventory_list.fr3",
    scope: "season",
    requires: "seasonId",
    build: (p) => buildInventoryList(p),
  },
  {
    key: "pool-totals",
    title: "Pool Totals",
    description: "Betting pools for a race — stake in, house cut, winners and payouts.",
    legacyTemplate: "pool_totals.fr3",
    scope: "race",
    requires: "raceId",
    build: (p) => buildPoolTotals(p),
  },
  {
    key: "fee-scheme",
    title: "Fee Scheme",
    description: "The full fee structure applied to a season's registrations.",
    legacyTemplate: "fee_scheme.fr3",
    scope: "scheme",
    requires: "seasonId",
    build: (p) => buildFeeScheme(p),
  },
  {
    key: "prize-scheme",
    title: "Prize Scheme",
    description: "Prize bands with the season's actual values and the total payable.",
    legacyTemplate: "prize_scheme.fr3",
    scope: "scheme",
    requires: "seasonId",
    build: (p) => buildPrizeScheme(p),
  },
  {
    key: "betting-scheme",
    title: "Betting Scheme",
    description: "Pool entry prices per tier, house cut and standard distribution percentages.",
    legacyTemplate: "betting_scheme.fr3",
    scope: "scheme",
    requires: "seasonId",
    build: (p) => buildBettingScheme(p),
  },
  {
    key: "breeder-labels",
    title: "Breeder Labels",
    description: "Mailing labels for every breeder registered in the season.",
    legacyTemplate: "breeder_labels.fr3",
    scope: "season",
    requires: "seasonId",
    isLabelSheet: true,
    build: (p) => buildLabels(p, true),
  },
  {
    key: "address-book-labels",
    title: "Address Book Labels",
    description: "Mailing labels for the full active breeder address book.",
    legacyTemplate: "address_book_labels.fr3",
    scope: "global",
    requires: null,
    isLabelSheet: true,
    build: (p) => buildLabels(p, false),
  },
];

export function findReport(key: string): ReportDefinition | undefined {
  return REPORTS.find((r) => r.key === key);
}
