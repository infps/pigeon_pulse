/**
 * Knockout tournaments.
 *
 * A tournament sits over ordinary races: each round points at one Race, so
 * check-in, scanning, results and prize money work exactly as they already do.
 * The tournament only decides which birds are still in.
 *
 * Advancing a round is the one destructive step, and it is guarded: the round's
 * race must have ended and no bird may still be in the air, because cutting
 * while birds are flying would eliminate them for not having arrived yet.
 */

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { TournamentCutMode } from "@/generated/prisma/enums";

type Tx = Prisma.TransactionClient;

export interface AdvanceResult {
  tournamentId: number;
  roundNumber: number;
  cutMode: TournamentCutMode;
  cutValue: number;
  entered: number;
  survived: number;
  eliminated: number;
  didNotArrive: number;
  nextRoundNumber: number | null;
  complete: boolean;
}

/** Field size that survives a cut, given the mode. Always at least one bird. */
export function survivorTarget(
  mode: TournamentCutMode,
  value: number,
  fieldSize: number
): number {
  if (fieldSize <= 0) return 0;
  if (mode === "TOP_PERCENT") {
    const pct = Math.max(0, Math.min(100, value));
    return Math.max(1, Math.floor((fieldSize * pct) / 100));
  }
  if (mode === "TOP_N") {
    return Math.max(1, Math.min(fieldSize, Math.floor(value)));
  }
  // MANUAL: the operator picks; nothing is implied.
  return fieldSize;
}

/** Seed a tournament with every bird registered in its season. */
export async function seedEntries(tournamentId: number): Promise<number> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { seasonId: true },
  });
  if (!tournament) throw new Error("That tournament no longer exists.");

  const items = await prisma.eventInventoryItem.findMany({
    where: {
      eventInventory: { seasonId: tournament.seasonId },
      replacedItemId: null,
      NOT: { isBackup: 1 },
      bird: { NOT: { isLost: 1 } },
    },
    select: { id: true },
  });

  if (items.length === 0) return 0;

  const result = await prisma.tournamentEntry.createMany({
    data: items.map((item) => ({ tournamentId, inventoryItemId: item.id })),
    skipDuplicates: true,
  });
  return result.count;
}

/** Birds still in the tournament. */
export async function aliveEntries(
  tx: Tx,
  tournamentId: number
): Promise<Array<{ inventoryItemId: number }>> {
  return tx.tournamentEntry.findMany({
    where: { tournamentId, eliminatedRound: null },
    select: { inventoryItemId: true },
  });
}

/**
 * Apply a round's cut and open the next one.
 *
 * Survivors are the best-placed arrivals among the birds still in. A bird that
 * did not arrive is eliminated regardless of the cut size — it did not finish.
 *
 * With MANUAL, `keepItemIds` decides who stays; the cut value is ignored.
 */
export async function advanceRound(
  tournamentId: number,
  options: { keepItemIds?: number[] } = {}
): Promise<AdvanceResult> {
  return prisma.$transaction(
    async (tx) => {
      const tournament = await tx.tournament.findUnique({
        where: { id: tournamentId },
        select: {
          id: true,
          cutMode: true,
          cutValue: true,
          status: true,
          rounds: { orderBy: { roundNumber: "asc" } },
        },
      });
      if (!tournament) throw new Error("That tournament no longer exists.");
      if (tournament.status === "COMPLETE") {
        throw new Error("This tournament is already complete.");
      }

      const round = tournament.rounds.find((r) => r.status !== "CUT_APPLIED");
      if (!round) throw new Error("Every round has already been cut. Add a round first.");
      if (round.raceId == null) {
        throw new Error(`Round ${round.roundNumber} has no race attached yet.`);
      }

      const race = await tx.race.findUnique({
        where: { id: round.raceId },
        select: { id: true, status: true, name: true },
      });
      if (!race) throw new Error("The race for this round no longer exists.");

      // The guard the spec asked for: never cut while birds are still flying.
      if (race.status !== "ENDED") {
        throw new Error(
          `Round ${round.roundNumber} cannot be cut until its race has ended.`
        );
      }
      const stillFlying = await tx.raceItem.count({
        where: { raceId: round.raceId, status: "RELEASED" },
      });
      if (stillFlying > 0) {
        throw new Error(
          `${stillFlying} bird${stillFlying === 1 ? " is" : "s are"} still recorded as in the air. Resolve them before cutting.`
        );
      }

      const alive = await aliveEntries(tx, tournamentId);
      const aliveIds = new Set(alive.map((a) => a.inventoryItemId));
      if (aliveIds.size === 0) throw new Error("No birds are left in this tournament.");

      // Results for the birds still in, best placed first. Only arrivals count.
      const results = await tx.raceItem.findMany({
        where: {
          raceId: round.raceId,
          inventoryItemId: { in: [...aliveIds] },
          result: { arrivalTime: { not: null } },
          status: { notIn: ["IGNORED", "STRAY", "LOST"] },
        },
        select: {
          inventoryItemId: true,
          result: { select: { birdPosition: true, arrivalTime: true } },
        },
      });

      const finished = results
        .filter((r) => r.inventoryItemId != null)
        .sort((a, b) => {
          const pa = a.result?.birdPosition ?? Number.MAX_SAFE_INTEGER;
          const pb = b.result?.birdPosition ?? Number.MAX_SAFE_INTEGER;
          if (pa !== pb) return pa - pb;
          const ta = a.result?.arrivalTime?.getTime() ?? Number.MAX_SAFE_INTEGER;
          const tb = b.result?.arrivalTime?.getTime() ?? Number.MAX_SAFE_INTEGER;
          return ta - tb;
        });

      const mode = round.cutMode ?? tournament.cutMode;
      const value = round.cutValue ?? tournament.cutValue;

      let survivors: number[];
      if (mode === "MANUAL") {
        const keep = new Set(options.keepItemIds ?? []);
        if (keep.size === 0) {
          throw new Error("A manual cut needs the birds to keep.");
        }
        // A hand-picked bird still has to have finished the round.
        const finishedIds = new Set(finished.map((f) => f.inventoryItemId!));
        survivors = [...keep].filter((id) => finishedIds.has(id));
        if (survivors.length === 0) {
          throw new Error("None of the selected birds finished this round.");
        }
      } else {
        const target = survivorTarget(mode, value, finished.length);
        survivors = finished.slice(0, target).map((f) => f.inventoryItemId!);
      }

      const survivorSet = new Set(survivors);
      const eliminated = [...aliveIds].filter((id) => !survivorSet.has(id));
      const didNotArrive = [...aliveIds].filter(
        (id) => !finished.some((f) => f.inventoryItemId === id)
      ).length;

      const now = new Date();
      if (eliminated.length > 0) {
        await tx.tournamentEntry.updateMany({
          where: { tournamentId, inventoryItemId: { in: eliminated } },
          data: { eliminatedRound: round.roundNumber, eliminatedAt: now },
        });
      }

      // Record where the survivors placed, so a finished tournament has standings.
      for (const [index, itemId] of survivors.entries()) {
        await tx.tournamentEntry.update({
          where: { tournamentId_inventoryItemId: { tournamentId, inventoryItemId: itemId } },
          data: { finalPosition: index + 1 },
        });
      }

      await tx.tournamentRound.update({
        where: { id: round.id },
        data: { status: "CUT_APPLIED", survivorCount: survivors.length, appliedAt: now },
      });

      // One survivor means a winner; otherwise open the next round.
      const complete = survivors.length <= 1;
      let nextRoundNumber: number | null = null;

      if (complete) {
        await tx.tournament.update({
          where: { id: tournamentId },
          data: { status: "COMPLETE" },
        });
      } else {
        nextRoundNumber = round.roundNumber + 1;
        const existing = tournament.rounds.find((r) => r.roundNumber === nextRoundNumber);
        if (!existing) {
          await tx.tournamentRound.create({
            data: { tournamentId, roundNumber: nextRoundNumber, status: "PENDING" },
          });
        }
        await tx.tournament.update({
          where: { id: tournamentId },
          data: { status: "RUNNING" },
        });
      }

      return {
        tournamentId,
        roundNumber: round.roundNumber,
        cutMode: mode,
        cutValue: value,
        entered: aliveIds.size,
        survived: survivors.length,
        eliminated: eliminated.length,
        didNotArrive,
        nextRoundNumber,
        complete,
      };
    },
    { maxWait: 20000, timeout: 180000 }
  );
}

/** Everything the tournament screen needs in one shape. */
export async function tournamentState(tournamentId: number) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      name: true,
      cutMode: true,
      cutValue: true,
      status: true,
      seasonId: true,
      rounds: {
        orderBy: { roundNumber: "asc" },
        select: {
          id: true,
          roundNumber: true,
          raceId: true,
          cutMode: true,
          cutValue: true,
          status: true,
          survivorCount: true,
          appliedAt: true,
          race: {
            select: { id: true, name: true, raceNumber: true, status: true },
          },
        },
      },
    },
  });
  if (!tournament) return null;

  const [alive, total] = await Promise.all([
    prisma.tournamentEntry.count({ where: { tournamentId, eliminatedRound: null } }),
    prisma.tournamentEntry.count({ where: { tournamentId } }),
  ]);

  return { ...tournament, aliveCount: alive, totalCount: total };
}
