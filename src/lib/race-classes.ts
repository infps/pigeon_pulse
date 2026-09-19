/**
 * Race classes — the pools breeders buy into.
 *
 * WinCompanion models these as lettered classes (A–F), each with a fee and a
 * payout shape. The shapes are the three we already settle bets with, so a class
 * maps onto the existing engine rather than a second one:
 *
 *   RATIO  -> one prize per przEntry entries      ("10 for 1")
 *   PLACES -> przEntry places, split by percent   ("50, 30, 20")
 *   WTA    -> winner takes all
 *
 * The money rules follow the ones already proven against HayLoft: the house cut
 * comes off the pool before anything is distributed, and a pool nobody can be
 * paid out of is refunded rather than kept.
 */

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { ClassPayoutType } from "@/generated/prisma/enums";

type Tx = Prisma.TransactionClient;

/** Below this many paid entries a pool is refunded, matching the betting rule. */
export const MIN_POOL_ENTRIES = 20;

export interface ClassPayoutRow {
  entryId: number;
  inventoryItemId: number;
  band: string;
  breederName: string;
  position: number | null;
  payout: number;
}

export interface ClassPayoutResult {
  raceClassId: number;
  code: string;
  payoutType: ClassPayoutType;
  przEntry: number;
  entries: number;
  placed: number;
  pool: number;
  cut: number;
  distributable: number;
  paid: number;
  refunded: boolean;
  rows: ClassPayoutRow[];
  warnings: string[];
}

/**
 * How many winners a class pays, given the field size.
 *
 * RATIO divides the field; PLACES is fixed; WTA is one. Never more winners than
 * there are placed birds.
 */
export function winnerCount(
  type: ClassPayoutType,
  przEntry: number,
  placed: number
): number {
  if (placed <= 0) return 0;
  switch (type) {
    case "WTA":
      return 1;
    case "RATIO":
      // "10 for 1": a field of 25 with przEntry 10 pays 2.
      return Math.max(1, Math.min(placed, Math.floor(placed / Math.max(1, przEntry))));
    case "PLACES":
      return Math.min(placed, Math.max(1, przEntry));
  }
}

/**
 * Share of the distributable pool for each winning position.
 *
 * PLACES uses the season's standard-show percentages when they cover the
 * places being paid; otherwise every winner takes an equal share, which is what
 * RATIO and WTA do by definition.
 */
export function payoutShares(
  type: ClassPayoutType,
  winners: number,
  percentages: Array<{ place: number | null; percValue: number | null }>
): number[] {
  if (winners <= 0) return [];

  if (type === "PLACES") {
    const byPlace = new Map(
      percentages
        .filter((p) => p.place != null && p.percValue != null)
        .map((p) => [p.place as number, p.percValue as number])
    );
    const shares: number[] = [];
    let total = 0;
    for (let place = 1; place <= winners; place++) {
      const pct = byPlace.get(place);
      if (pct == null) break;
      shares.push(pct);
      total += pct;
    }
    // Only trust the table if it covers every place and is a sane total.
    if (shares.length === winners && total > 0) {
      return shares.map((pct) => pct / total);
    }
  }

  return Array.from({ length: winners }, () => 1 / winners);
}

/**
 * Settle one class for a race.
 *
 * Positions come from the race result that has already been calculated, so a
 * class never re-ranks anything — it only decides who in the class finished
 * best and divides the pool accordingly.
 */
export async function calcClassPayouts(
  tx: Tx,
  raceClassId: number,
  raceId: number,
  options: { commit?: boolean } = {}
): Promise<ClassPayoutResult> {
  const warnings: string[] = [];

  const raceClass = await tx.raceClass.findUnique({
    where: { id: raceClassId },
    select: {
      id: true,
      code: true,
      classFee: true,
      payoutType: true,
      przEntry: true,
      cutPercent: true,
      season: {
        select: {
          bettingScheme: {
            select: {
              bettingCutPercent: true,
              standardShowPercentages: { select: { place: true, percValue: true } },
            },
          },
        },
      },
    },
  });
  if (!raceClass) throw new Error("That class no longer exists.");

  const entries = await tx.raceClassEntry.findMany({
    where: { raceClassId },
    select: {
      id: true,
      feeCharged: true,
      inventoryItemId: true,
      inventoryItem: {
        select: {
          bird: { select: { band1: true, band2: true, band3: true, band4: true, band: true } },
          eventInventory: {
            select: { breeder: { select: { firstName: true, lastName: true } } },
          },
          raceItems: {
            where: { raceId },
            select: {
              status: true,
              result: { select: { birdPosition: true, arrivalTime: true } },
            },
          },
        },
      },
    },
  });

  const pool = entries.reduce((sum, e) => sum + (e.feeCharged ?? 0), 0);
  const cutPercent =
    raceClass.cutPercent ?? raceClass.season?.bettingScheme?.bettingCutPercent ?? 0;
  const cut = Math.round(pool * (cutPercent / 100) * 100) / 100;
  const distributable = Math.round((pool - cut) * 100) / 100;

  // A bird counts as placed if it finished this race and was not excluded.
  const placed = entries
    .map((e) => {
      const ri = e.inventoryItem?.raceItems?.[0];
      const excluded =
        ri?.status === "IGNORED" || ri?.status === "STRAY" || ri?.status === "LOST";
      const position = excluded ? null : (ri?.result?.birdPosition ?? null);
      const bird = e.inventoryItem?.bird;
      const breeder = e.inventoryItem?.eventInventory?.breeder;
      return {
        entryId: e.id,
        inventoryItemId: e.inventoryItemId,
        band:
          [bird?.band1, bird?.band2, bird?.band3, bird?.band4].filter(Boolean).join("-") ||
          bird?.band ||
          "",
        breederName: `${breeder?.firstName ?? ""} ${breeder?.lastName ?? ""}`.trim(),
        position,
        payout: 0,
      };
    })
    .filter((row) => row.position != null)
    .sort((a, b) => (a.position as number) - (b.position as number));

  const base: ClassPayoutResult = {
    raceClassId,
    code: raceClass.code,
    payoutType: raceClass.payoutType,
    przEntry: raceClass.przEntry,
    entries: entries.length,
    placed: placed.length,
    pool,
    cut,
    distributable,
    paid: 0,
    refunded: false,
    rows: placed,
    warnings,
  };

  // Too small a pool is returned rather than kept — the same rule the betting
  // payout applies, and the reason it exists is the same.
  if (entries.length < MIN_POOL_ENTRIES) {
    warnings.push(
      `Only ${entries.length} entries; a class needs ${MIN_POOL_ENTRIES} before it pays out. Fees should be refunded.`
    );
    return { ...base, refunded: true };
  }

  if (placed.length === 0) {
    warnings.push("No bird in this class finished the race, so there is nothing to pay.");
    return { ...base, refunded: true };
  }

  const winners = winnerCount(raceClass.payoutType, raceClass.przEntry, placed.length);
  const shares = payoutShares(
    raceClass.payoutType,
    winners,
    raceClass.season?.bettingScheme?.standardShowPercentages ?? []
  );

  let paid = 0;
  for (let i = 0; i < winners; i++) {
    const amount = Math.round(distributable * shares[i] * 100) / 100;
    placed[i].payout = amount;
    paid += amount;
  }

  if (options.commit) {
    for (const row of placed) {
      await tx.raceClassEntry.update({
        where: { id: row.entryId },
        data: { position: row.position, payoutValue: row.payout || null },
      });
    }
  }

  return { ...base, paid: Math.round(paid * 100) / 100, rows: placed };
}

/** Settle every active class in a season against one race. */
export async function calcSeasonClassPayouts(
  seasonId: number,
  raceId: number,
  options: { commit?: boolean } = {}
): Promise<ClassPayoutResult[]> {
  return prisma.$transaction(
    async (tx) => {
      const classes = await tx.raceClass.findMany({
        where: { seasonId, isActive: true },
        orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
        select: { id: true },
      });

      const results: ClassPayoutResult[] = [];
      for (const c of classes) {
        results.push(await calcClassPayouts(tx, c.id, raceId, options));
      }
      return results;
    },
    { maxWait: 20000, timeout: 180000 }
  );
}
