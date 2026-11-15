/**
 * Average-speed winners and their prizes, as HayLoft computes them.
 *
 * Ports of HayLoft's stored procedures:
 *   CALC_FLIGHT_TIME         daylight flight time: only the hours between
 *                            sunrise and sunset of each day count
 *   CALC_SPEED_INT           yards per minute and miles per hour
 *   CALC_RACE_AVG_SPEED_INT  per bird, over the chosen races: races flown,
 *                            total distance, total flight time, average speed
 *   RACE_AVG_SPEED_GET       rank by races flown, then speed; each rank's prize
 *                            from the season's average prize scheme (race type 9)
 *   AVG_WINNER_PRIZE_SET     store the prizes (AvgWinnerPrizes), which the
 *                            breeder's account then pays (WINNER_PRIZE_PAYOUT_BIRD_GET)
 *
 * HayLoft works in the clubs' wall-clock time (America/Los_Angeles, as the
 * import assumed). Sunrise and sunset imported from HayLoft are stored as a
 * time of day on 1970-01-01, shifted by −5:30 (how the original import wrote
 * TIME columns); those set in the portal are instants on the race day.
 *
 * Checked against HayLoft's own RACE_AVG_SPEED_GET: scripts/hayloft-sync/reconcile-avg-speed.ts.
 */

import { prisma } from "@/lib/prisma";
import { raceTypeWithRole } from "@/lib/hayloft-account";

export const HAYLOFT_TIME_ZONE = "America/Los_Angeles";

const DAY = 86_400_000;
const IMPORT_TIME_SHIFT = 330 * 60_000; // the original import wrote TIME columns 5:30 early

const tzParts = new Intl.DateTimeFormat("en-US", {
  timeZone: HAYLOFT_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
});

/** An instant as HayLoft's wall-clock time, as a naive ms count (UTC fields = local fields). */
export function wallClock(d: Date): number {
  const p = Object.fromEntries(tzParts.formatToParts(d).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second, d.getUTCMilliseconds());
}

/** A sunrise / sunset value as milliseconds after local midnight. */
export function timeOfDay(d: Date): number {
  if (d.getUTCFullYear() <= 1970) {
    // Imported TIME column: 1970-01-01 at the local time, written 5:30 early.
    return (((d.getTime() + IMPORT_TIME_SHIFT) % DAY) + DAY) % DAY;
  }
  return ((wallClock(d) % DAY) + DAY) % DAY;
}

/** CALC_FLIGHT_TIME, in milliseconds. Inputs are naive wall-clock ms. */
export function flightTimeMs(start: number, arrival: number | null, sunrise: number | null, sunset: number | null): number {
  if (arrival == null) return 0;
  if (sunrise == null || sunset == null) return Math.round(arrival - start);
  let total = 0;
  const lastDay = Math.floor(arrival / DAY) * DAY;
  // TMP_DATE = START_TIME assigned to a DATE: the start's day.
  for (let day = Math.floor(start / DAY) * DAY; day <= lastDay; day += DAY) {
    const from = Math.max(start, day + sunrise);
    const to = Math.min(arrival, day + sunset);
    if (to > from) total += to - from;
  }
  return Math.round(total);
}

/** CALC_SPEED_INT: NUMERIC(15,4) ÷ BIGINT, truncated to 4 decimals. */
export function speeds(distanceMiles: number, flightMs: number): { yardsPerMin: number | null; milesPerHour: number | null } {
  if (!(distanceMiles > 0) || !(flightMs > 0)) return { yardsPerMin: null, milesPerHour: null };
  const t4 = (x: number) => Math.trunc(x * 10_000) / 10_000;
  return {
    yardsPerMin: t4((distanceMiles * 1760 * 60 * 1000) / flightMs),
    milesPerHour: t4((distanceMiles * 60 * 60 * 1000) / flightMs),
  };
}

export interface AvgSpeedRow {
  inventoryItemId: number;
  position: number;
  raceCount: number;
  totalFlightMs: number;
  totalDistance: number;
  yardsPerMin: number | null;
  milesPerHour: number | null;
  prize: number | null;
}

/**
 * RACE_AVG_SPEED_GET over the chosen races of a season.
 * onlyHotSpotPaid: count only birds with a hot spot fee (HOT_SPOT_FEE_VALUE is not null).
 * calcPrize: look up each rank's prize from the season's average prize scheme.
 */
export async function averageSpeedWinners(
  seasonId: number,
  raceIds: number[],
  opts: { onlyHotSpotPaid?: boolean; calcPrize?: boolean } = {}
): Promise<AvgSpeedRow[]> {
  const races = await prisma.race.findMany({
    where: { id: { in: raceIds }, seasonId },
    select: { id: true, distance: true, startTime: true, sunrise: true, sunset: true },
  });
  const raceById = new Map(races.map((r) => [r.id, r]));

  const results = await prisma.raceItemResult.findMany({
    where: {
      birdPosition: { not: null },
      raceItem: {
        raceId: { in: races.filter((r) => (r.distance ?? 0) > 0).map((r) => r.id) },
        inventoryItemId: { not: null },
        ...(opts.onlyHotSpotPaid ? { inventoryItem: { hotSpotFeeValue: { not: null } } } : {}),
      },
    },
    select: { arrivalTime: true, raceItem: { select: { raceId: true, inventoryItemId: true } } },
  });

  const byItem = new Map<number, { raceCount: number; totalFlightMs: number; totalDistance: number }>();
  for (const r of results) {
    const race = r.raceItem.raceId != null ? raceById.get(r.raceItem.raceId) : undefined;
    const itemId = r.raceItem.inventoryItemId as number;
    if (!race || race.startTime == null) continue;
    const acc = byItem.get(itemId) ?? { raceCount: 0, totalFlightMs: 0, totalDistance: 0 };
    acc.raceCount += 1;
    acc.totalDistance += race.distance ?? 0;
    acc.totalFlightMs += flightTimeMs(
      wallClock(race.startTime),
      r.arrivalTime ? wallClock(r.arrivalTime) : null,
      race.sunrise ? timeOfDay(race.sunrise) : null,
      race.sunset ? timeOfDay(race.sunset) : null
    );
    byItem.set(itemId, acc);
  }

  const rows = [...byItem.entries()].map(([inventoryItemId, a]) => ({
    inventoryItemId,
    ...a,
    ...speeds(a.totalDistance, a.totalFlightMs),
  }));
  // order by RACE_COUNT desc, AVG_SPEED_IN_YARDS desc, AVG_SPEED_IN_MILES desc (nulls last).
  // Full ties only happen for birds with no speed (bad arrival times); HayLoft's
  // order among them is whatever its sort returns. Total flight time, then id,
  // reproduces it in 226 of 233 such pairs in HayLoft's data.
  const desc = (a: number | null, b: number | null) => (b ?? -Infinity) - (a ?? -Infinity);
  rows.sort(
    (a, b) =>
      b.raceCount - a.raceCount ||
      desc(a.yardsPerMin, b.yardsPerMin) ||
      desc(a.milesPerHour, b.milesPerHour) ||
      a.totalFlightMs - b.totalFlightMs ||
      a.inventoryItemId - b.inventoryItemId
  );

  // GET_PRIZE_VALUE(scheme, event, 9, pos, pos), 9 = the AVERAGE role: the PrizeValue of every band covering pos.
  let prizeAt: (pos: number) => number | null = () => null;
  if (opts.calcPrize) {
    const season = await prisma.season.findUnique({ where: { id: seasonId }, select: { hotSpotAvgPrizeSchemeId: true } });
    const items = season?.hotSpotAvgPrizeSchemeId
      ? await prisma.prizeSchemeItem.findMany({
          where: { prizeSchemeId: season.hotSpotAvgPrizeSchemeId },
          select: {
            fromPosition: true,
            toPosition: true,
            prizeValues: { where: { seasonId, raceType: raceTypeWithRole("AVERAGE") }, select: { prizeValue: true } },
          },
        })
      : [];
    prizeAt = (pos) => {
      let v: number | null = null;
      for (const it of items) {
        if ((it.fromPosition ?? 0) <= pos && (it.toPosition ?? 0) >= pos) {
          for (const pv of it.prizeValues) v = (v ?? 0) + (pv.prizeValue ?? 0);
        }
      }
      return v;
    };
  }

  return rows.map((r, i) => ({ ...r, position: i + 1, prize: prizeAt(i + 1) }));
}

/**
 * Store the average-speed prizes (AVG_WINNER_PRIZE_SET): clear the season's,
 * then set each placed bird's. Returns how many were set and their total.
 */
export async function setAverageSpeedPrizes(
  seasonId: number,
  rows: Array<{ inventoryItemId: number; prize: number | null }>
): Promise<{ set: number; total: number }> {
  const paid = rows.filter((r) => r.prize != null);
  await prisma.$transaction(async (tx) => {
    await tx.avgWinnerPrizes.deleteMany({ where: { seasonId } });
    if (paid.length) {
      await tx.avgWinnerPrizes.createMany({
        data: paid.map((r) => ({ inventoryItemId: r.inventoryItemId, seasonId, prizeValue: r.prize })),
      });
    }
  });
  return { set: paid.length, total: Math.round(paid.reduce((s, r) => s + (r.prize ?? 0), 0) * 100) / 100 };
}
