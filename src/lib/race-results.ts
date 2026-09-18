/**
 * Race result engine — positions, hotspot positions and prize money.
 *
 * This is a direct port of the HayLoft stored procedures that had no
 * counterpart in this codebase:
 *
 *   RACE_ITEM_RESULT_POSITION_CALC   -> recalcPositions
 *   RACE_ITEM_RESULT_HS_POS_CALC     -> recalcHotspotPositions
 *   GET_PRIZE_VALUE                  -> folded into calcRacePrizes
 *   RACE_ITEM_PRIZE_VALUE_CALC_INT   -> folded into calcRacePrizes
 *   RACE_PRIZE_VALUE_CALC            -> calcRacePrizes
 *   RACE_RECALC                      -> recalcRace
 *
 * Legacy behaviour preserved deliberately:
 *   - Only races whose type has a prize role (legacy: type IDs 5,6,7,8) get prizes.
 *   - In the FINAL race, a bird only receives a position if its entry fee is paid.
 *   - Hotspot positions only count birds that actually paid a hotspot fee.
 *   - Birds in the same "drop" share the sum of their positions' prizes equally.
 *   - Lost birds are excluded from both rankings.
 *   - A bird with no matching prize band gets NULL, not zero.
 *
 * Deliberate departure from legacy: birds on the race's ignore list are also
 * excluded from ranking. HayLoft had RACE_IGNORE_BIRD but never applied it here.
 *
 * Implementation note: the legacy procedures looped row by row, which is free
 * inside the database engine but not from an application server talking to a
 * remote Postgres — a 450-bird race would be ~1,000 sequential round trips.
 * Each stage is therefore a single set-based statement.
 */

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { RaceTypePrizeRole } from "@/generated/prisma/enums";

/** Prisma transaction client — every helper runs inside one. */
type Tx = Prisma.TransactionClient;

export interface RecalcSummary {
  raceId: number;
  raceTypeName: string | null;
  prizeRole: RaceTypePrizeRole;
  positionsAssigned: number;
  hotspotPositionsAssigned: number;
  prizesAwarded: number;
  prizeTotal: number;
  skippedUnpaid: number;
  skippedIgnored: number;
  warnings: string[];
  /** Rows whose position, hotspot position or prize would change. */
  changes: RecalcChange[];
  changedCount: number;
  dryRun: boolean;
}

export interface RecalcChange {
  raceItemId: number;
  band: string | null;
  before: { position: number | null; hotspotPosition: number | null; prize: number | null };
  after: { position: number | null; hotspotPosition: number | null; prize: number | null };
}

/** Thrown to roll back a dry run once its results have been captured. */
class DryRunRollback extends Error {
  constructor(readonly payload: RecalcSummary) {
    super("dry run rollback");
  }
}

/**
 * Serialise all position work for a race.
 *
 * Arrival scanning assigns positions incrementally and recalculation rewrites
 * them wholesale; both must be the only writer for the race while they run.
 * A row lock on the Race is the cheapest way to guarantee that — it makes
 * concurrent scans queue instead of computing the same position twice.
 */
export async function lockRace(tx: Tx, raceId: number): Promise<void> {
  await tx.$queryRaw`SELECT "ID_RACE" FROM "Race" WHERE "ID_RACE" = ${raceId} FOR UPDATE`;
}

/**
 * Port of RACE_ITEM_RESULT_POSITION_CALC.
 *
 * Clears every position on the race, then numbers arrivals oldest-first from 1.
 * In a FINAL race an unpaid bird is skipped entirely — it keeps its arrival
 * time but never receives a position, so the bird behind it inherits the place.
 *
 * Ties on arrival time are broken by race item ID so the ordering is stable
 * across runs. Legacy left ties to the database's whim.
 */
export async function recalcPositions(
  tx: Tx,
  raceId: number,
  isFinal: boolean
): Promise<{ assigned: number; skippedUnpaid: number; skippedIgnored: number }> {
  await tx.$executeRaw`
    UPDATE "RaceItemResult" t
    SET "BIRD_POSITION" = NULL
    FROM "RaceItem" ri
    WHERE ri."ID_RACE_ITEM" = t."ID_RACE_ITEM"
      AND ri."ID_RACE" = ${raceId}
      AND t."BIRD_POSITION" IS NOT NULL`;

  const assigned = await tx.$executeRaw`
    WITH eligible AS (
      SELECT rir."ID_RACE_ITEM" AS id,
             ROW_NUMBER() OVER (
               ORDER BY rir."ARRIVAL_TIME" ASC, rir."ID_RACE_ITEM" ASC
             ) AS pos
      FROM "RaceItemResult" rir
      JOIN "RaceItem" ri ON ri."ID_RACE_ITEM" = rir."ID_RACE_ITEM"
      LEFT JOIN "EventInventoryItem" eii
             ON eii."ID_EVENT_INVENTORY_ITEM" = ri."ID_INVENTORY_ITEM"
      WHERE ri."ID_RACE" = ${raceId}
        AND COALESCE(ri."IS_LOST", 0) <> 1
        AND rir."ARRIVAL_TIME" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "RaceIgnoreBird" ib
          WHERE ib."ID_RACE" = ${raceId}
            AND ib."ID_EVENT_INVENTORY_ITEM" = ri."ID_INVENTORY_ITEM"
        )
        AND (${isFinal}::boolean = false OR COALESCE(eii."ENTRY_FEE_PAID", 0) = 1)
    )
    UPDATE "RaceItemResult" t
    SET "BIRD_POSITION" = eligible.pos
    FROM eligible
    WHERE t."ID_RACE_ITEM" = eligible.id`;

  // Counts for the operator-facing summary.
  const [counts] = await tx.$queryRaw<
    Array<{ skipped_unpaid: bigint; skipped_ignored: bigint }>
  >`
    SELECT
      COUNT(*) FILTER (
        WHERE ${isFinal}::boolean = true AND COALESCE(eii."ENTRY_FEE_PAID", 0) <> 1
      ) AS skipped_unpaid,
      COUNT(*) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM "RaceIgnoreBird" ib
          WHERE ib."ID_RACE" = ${raceId}
            AND ib."ID_EVENT_INVENTORY_ITEM" = ri."ID_INVENTORY_ITEM"
        )
      ) AS skipped_ignored
    FROM "RaceItemResult" rir
    JOIN "RaceItem" ri ON ri."ID_RACE_ITEM" = rir."ID_RACE_ITEM"
    LEFT JOIN "EventInventoryItem" eii
           ON eii."ID_EVENT_INVENTORY_ITEM" = ri."ID_INVENTORY_ITEM"
    WHERE ri."ID_RACE" = ${raceId}
      AND COALESCE(ri."IS_LOST", 0) <> 1
      AND rir."ARRIVAL_TIME" IS NOT NULL`;

  return {
    assigned,
    skippedUnpaid: Number(counts?.skipped_unpaid ?? 0),
    skippedIgnored: Number(counts?.skipped_ignored ?? 0),
  };
}

/**
 * Port of RACE_ITEM_RESULT_HS_POS_CALC.
 *
 * Separate ranking over the same arrivals, restricted to birds that paid a
 * hotspot fee. Runs on any race type with a prize role, matching legacy's
 * "race type in (5,6,7,8)" guard.
 */
export async function recalcHotspotPositions(
  tx: Tx,
  raceId: number
): Promise<{ assigned: number }> {
  await tx.$executeRaw`
    UPDATE "RaceItemResult" t
    SET "BIRD_POSITION_HOT_SPOT" = NULL
    FROM "RaceItem" ri
    WHERE ri."ID_RACE_ITEM" = t."ID_RACE_ITEM"
      AND ri."ID_RACE" = ${raceId}
      AND t."BIRD_POSITION_HOT_SPOT" IS NOT NULL`;

  const assigned = await tx.$executeRaw`
    WITH eligible AS (
      SELECT rir."ID_RACE_ITEM" AS id,
             ROW_NUMBER() OVER (
               ORDER BY rir."ARRIVAL_TIME" ASC, rir."ID_RACE_ITEM" ASC
             ) AS pos
      FROM "RaceItemResult" rir
      JOIN "RaceItem" ri ON ri."ID_RACE_ITEM" = rir."ID_RACE_ITEM"
      JOIN "EventInventoryItem" eii
             ON eii."ID_EVENT_INVENTORY_ITEM" = ri."ID_INVENTORY_ITEM"
      WHERE ri."ID_RACE" = ${raceId}
        AND COALESCE(ri."IS_LOST", 0) <> 1
        AND rir."ARRIVAL_TIME" IS NOT NULL
        AND COALESCE(eii."HOT_SPOT_FEE_VALUE", 0) > 0
        AND NOT EXISTS (
          SELECT 1 FROM "RaceIgnoreBird" ib
          WHERE ib."ID_RACE" = ${raceId}
            AND ib."ID_EVENT_INVENTORY_ITEM" = ri."ID_INVENTORY_ITEM"
        )
    )
    UPDATE "RaceItemResult" t
    SET "BIRD_POSITION_HOT_SPOT" = eligible.pos
    FROM eligible
    WHERE t."ID_RACE_ITEM" = eligible.id`;

  return { assigned };
}

/** Resolve the season prize scheme a race draws from, by its type's role. */
function schemeForRole(
  role: RaceTypePrizeRole,
  season: {
    finalPrizeSchemeId: number | null;
    hotSpot1PrizeSchemeId: number | null;
    hotSpot2PrizeSchemeId: number | null;
    hotSpot3PrizeSchemeId: number | null;
    hotSpotAvgPrizeSchemeId: number | null;
  }
): number | null {
  switch (role) {
    case "FINAL":     return season.finalPrizeSchemeId;
    case "HOTSPOT_1": return season.hotSpot1PrizeSchemeId;
    case "HOTSPOT_2": return season.hotSpot2PrizeSchemeId;
    case "HOTSPOT_3": return season.hotSpot3PrizeSchemeId;
    case "AVERAGE":   return season.hotSpotAvgPrizeSchemeId;
    default:          return null;
  }
}

/**
 * Port of RACE_PRIZE_VALUE_CALC + RACE_ITEM_PRIZE_VALUE_CALC_INT + GET_PRIZE_VALUE.
 *
 * FINAL races pay on birdPosition; every other prize-carrying role pays on
 * birdPositionHotSpot. The money comes from PrizeValue (per season + race type
 * + band), not the band's own template amount — same as legacy, where
 * PRIZE_SCHEME_ITEM.PRIZE_VALUE is only a default and PRIZE_VALUE holds what
 * the event actually pays.
 *
 * Birds sharing a drop split the pooled prize of their positions equally, with
 * unmatched positions counted as zero in the pool (legacy used coalesce there,
 * but left a lone bird's prize NULL rather than zero).
 */
export async function calcRacePrizes(
  tx: Tx,
  raceId: number
): Promise<{ awarded: number; total: number; warnings: string[] }> {
  const warnings: string[] = [];

  const race = await tx.race.findUnique({
    where: { id: raceId },
    select: {
      id: true,
      seasonId: true,
      raceTypeId: true,
      raceType: { select: { prizeRole: true, name: true } },
      seasonRel: {
        select: {
          finalPrizeSchemeId: true,
          hotSpot1PrizeSchemeId: true,
          hotSpot2PrizeSchemeId: true,
          hotSpot3PrizeSchemeId: true,
          hotSpotAvgPrizeSchemeId: true,
        },
      },
    },
  });

  // Clear first — a race that no longer qualifies must not keep stale money.
  await tx.$executeRaw`
    UPDATE "RaceItemResult" t
    SET "PRIZE_VALUE" = NULL
    FROM "RaceItem" ri
    WHERE ri."ID_RACE_ITEM" = t."ID_RACE_ITEM"
      AND ri."ID_RACE" = ${raceId}
      AND t."PRIZE_VALUE" IS NOT NULL`;

  const role = race?.raceType?.prizeRole ?? "NONE";
  if (!race || role === "NONE") return { awarded: 0, total: 0, warnings };

  if (race.seasonId == null || race.raceTypeId == null || !race.seasonRel) {
    warnings.push("Race is not attached to a season or race type; no prizes calculated.");
    return { awarded: 0, total: 0, warnings };
  }

  const schemeId = schemeForRole(role, race.seasonRel);
  if (schemeId == null) {
    warnings.push(
      `Season has no ${role.replace(/_/g, " ").toLowerCase()} prize scheme assigned; no prizes calculated.`
    );
    return { awarded: 0, total: 0, warnings };
  }

  const isFinal = role === "FINAL";
  const { seasonId, raceTypeId } = race;

  // One statement:
  //   placed  — birds holding the position this role pays on
  //   banded  — each bird's own prize, NULL when no band/value matches
  //   final   — singles keep their own value; drops take the group average,
  //             counting unmatched members as zero
  await tx.$executeRaw`
    WITH placed AS (
      SELECT rir."ID_RACE_ITEM" AS id,
             rir."BIRD_DROP"    AS drop_no,
             CASE WHEN ${isFinal}::boolean
                  THEN rir."BIRD_POSITION"
                  ELSE rir."BIRD_POSITION_HOT_SPOT"
             END AS pos
      FROM "RaceItemResult" rir
      JOIN "RaceItem" ri ON ri."ID_RACE_ITEM" = rir."ID_RACE_ITEM"
      WHERE ri."ID_RACE" = ${raceId}
    ),
    banded AS (
      SELECT p.id,
             p.drop_no,
             SUM(pv."PRIZE_VALUE") AS prize
      FROM placed p
      LEFT JOIN "PrizeSchemeItem" psi
             ON psi."ID_PRIZE_SCHEME" = ${schemeId}
            AND psi."FROM_POSITION" <= p.pos
            AND psi."TO_POSITION"   >= p.pos
      LEFT JOIN "PrizeValue" pv
             ON pv."ID_PRIZE_SCHEME_ITEM" = psi."ID_PRIZE_SCHEME_ITEM"
            AND pv."SEASON_ID"            = ${seasonId}
            AND pv."ID_RACE_TYPE"         = ${raceTypeId}
      WHERE p.pos IS NOT NULL
      GROUP BY p.id, p.drop_no
    ),
    resolved AS (
      SELECT id,
             -- Legacy stored prizes as NUMERIC(15,4); this column is double
             -- precision, so an even split like 25000/24 would otherwise
             -- differ from the legacy value in the far decimals.
             ROUND(
               (CASE
                 -- Drop-splitting is FINAL-only. Legacy's hotspot branch never
                 -- looked at BIRD_DROP: it paid each bird its own position's
                 -- prize even when the whole race shared one drop number.
                 WHEN ${isFinal}::boolean = false OR drop_no IS NULL THEN prize
                 ELSE NULLIF(AVG(COALESCE(prize, 0)) OVER (PARTITION BY drop_no), 0)
               END)::numeric,
               4
             )::double precision AS final_prize
      FROM banded
    )
    UPDATE "RaceItemResult" t
    SET "PRIZE_VALUE" = resolved.final_prize
    FROM resolved
    WHERE t."ID_RACE_ITEM" = resolved.id
      AND resolved.final_prize IS NOT NULL`;

  const [totals] = await tx.$queryRaw<Array<{ awarded: bigint; total: number | null }>>`
    SELECT COUNT(*) AS awarded, SUM(rir."PRIZE_VALUE") AS total
    FROM "RaceItemResult" rir
    JOIN "RaceItem" ri ON ri."ID_RACE_ITEM" = rir."ID_RACE_ITEM"
    WHERE ri."ID_RACE" = ${raceId} AND rir."PRIZE_VALUE" IS NOT NULL`;

  return {
    awarded: Number(totals?.awarded ?? 0),
    total: Number(totals?.total ?? 0),
    warnings,
  };
}

/**
 * Port of RACE_RECALC — the single entry point for rebuilding a race's results.
 *
 * Safe to run repeatedly: every stage clears before it writes, so the outcome
 * depends only on current arrival times, payments and the ignore list.
 *
 * With `dryRun`, the work is performed and measured inside a transaction that
 * is then rolled back, so an operator can preview the change before committing
 * money.
 */
export async function recalcRace(
  raceId: number,
  options: { dryRun?: boolean } = {}
): Promise<RecalcSummary> {
  const dryRun = options.dryRun === true;

  try {
    return await prisma.$transaction(
      async (tx) => {
        await lockRace(tx, raceId);

        const race = await tx.race.findUnique({
          where: { id: raceId },
          select: { id: true, raceType: { select: { name: true, prizeRole: true } } },
        });
        if (!race) throw new Error(`Race ${raceId} not found`);

        // Snapshot before anything is cleared, so the diff is meaningful.
        const before = await tx.raceItemResult.findMany({
          where: { raceItem: { raceId } },
          select: {
            raceItemId: true,
            birdPosition: true,
            birdPositionHotSpot: true,
            prizeValue: true,
          },
        });
        const beforeById = new Map(before.map((r) => [r.raceItemId, r]));

        const role = race.raceType?.prizeRole ?? "NONE";
        const isFinal = role === "FINAL";

        const positions = await recalcPositions(tx, raceId, isFinal);

        // Legacy ran hotspot ranking and prize calc only for prize-carrying types.
        let hotspot = { assigned: 0 };
        let prizes = { awarded: 0, total: 0, warnings: [] as string[] };
        if (role !== "NONE") {
          hotspot = await recalcHotspotPositions(tx, raceId);
          prizes = await calcRacePrizes(tx, raceId);
        } else {
          await tx.$executeRaw`
            UPDATE "RaceItemResult" t
            SET "BIRD_POSITION_HOT_SPOT" = NULL, "PRIZE_VALUE" = NULL
            FROM "RaceItem" ri
            WHERE ri."ID_RACE_ITEM" = t."ID_RACE_ITEM"
              AND ri."ID_RACE" = ${raceId}
              AND (t."BIRD_POSITION_HOT_SPOT" IS NOT NULL OR t."PRIZE_VALUE" IS NOT NULL)`;
        }

        const after = await tx.raceItemResult.findMany({
          where: { raceItem: { raceId } },
          select: {
            raceItemId: true,
            birdPosition: true,
            birdPositionHotSpot: true,
            prizeValue: true,
            raceItem: {
              select: {
                inventoryItem: {
                  select: {
                    bird: { select: { band1: true, band2: true, band3: true, band4: true } },
                  },
                },
              },
            },
          },
        });

        const changes: RecalcChange[] = [];
        for (const row of after) {
          const prev = beforeById.get(row.raceItemId);
          const samePosition = (prev?.birdPosition ?? null) === (row.birdPosition ?? null);
          const sameHotspot =
            (prev?.birdPositionHotSpot ?? null) === (row.birdPositionHotSpot ?? null);
          // Prize is a float; compare at legacy's stored precision so that
          // representation noise is not reported as an operator-visible change.
          const prevPrize = prev?.prizeValue ?? null;
          const nextPrize = row.prizeValue ?? null;
          const samePrize =
            prevPrize == null || nextPrize == null
              ? prevPrize === nextPrize
              : Math.abs(prevPrize - nextPrize) < 0.00005;
          if (samePosition && sameHotspot && samePrize) continue;

          const bird = row.raceItem?.inventoryItem?.bird;
          changes.push({
            raceItemId: row.raceItemId,
            band: bird
              ? [bird.band1, bird.band2, bird.band3, bird.band4].filter(Boolean).join("-")
              : null,
            before: {
              position: prev?.birdPosition ?? null,
              hotspotPosition: prev?.birdPositionHotSpot ?? null,
              prize: prev?.prizeValue ?? null,
            },
            after: {
              position: row.birdPosition ?? null,
              hotspotPosition: row.birdPositionHotSpot ?? null,
              prize: row.prizeValue ?? null,
            },
          });
        }

        const summary: RecalcSummary = {
          raceId,
          raceTypeName: race.raceType?.name ?? null,
          prizeRole: role,
          positionsAssigned: positions.assigned,
          hotspotPositionsAssigned: hotspot.assigned,
          prizesAwarded: prizes.awarded,
          prizeTotal: prizes.total,
          skippedUnpaid: positions.skippedUnpaid,
          skippedIgnored: positions.skippedIgnored,
          warnings: prizes.warnings,
          changes,
          changedCount: changes.length,
          dryRun,
        };

        // A dry run does all the same work, then throws to discard the writes.
        if (dryRun) throw new DryRunRollback(summary);

        return summary;
      },
      // A full season-final race can carry a few thousand birds.
      { maxWait: 20000, timeout: 180000 }
    );
  } catch (error) {
    if (error instanceof DryRunRollback) return error.payload;
    throw error;
  }
}
