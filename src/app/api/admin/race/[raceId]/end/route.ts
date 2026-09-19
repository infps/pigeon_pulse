import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { presetIdFor } from "@/lib/birdStatus";
import { recalcRace } from "@/lib/race-results";
import { notifyRaceEnded } from "@/lib/notifications";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

/**
 * End a race — port of HayLoft's RACE_CLOSE.
 *
 * Legacy did three things this route previously did not:
 *   1. Recorded the lost transition on the Bird and in LostHistory, not just
 *      on the RaceItem.
 *   2. Reversed the flag for birds marked lost that did in fact arrive
 *      (a recovery), so a re-run of the close corrects earlier mistakes.
 *   3. Recalculated positions and prize money once the lost set was final.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ raceId: string }> }
) {
  try {
    const guard = await requirePermission("races.manage");
    if ("error" in guard) return guard.error;
    const session = guard.session;

    const { raceId } = await params;
    const raceIdInt = parseInt(raceId);
    if (Number.isNaN(raceIdInt)) {
      return NextResponse.json({ message: "Invalid race ID" }, { status: 400 });
    }

    const race = await prisma.race.findUnique({
      where: { id: raceIdInt },
    });

    if (!race) {
      return NextResponse.json({ message: "Race not found" }, { status: 404 });
    }

    if (race.status !== "STARTED") {
      return NextResponse.json(
        { message: "Only a started race can be ended" },
        { status: 400 }
      );
    }

    const lostStatusId = await presetIdFor(race.seasonId, "LOST");
    const arrivedStatusId = await presetIdFor(race.seasonId, "ARRIVE");
    const now = new Date();

    const { updatedRace, lostCount, recoveredCount } = await prisma.$transaction(
      async (tx) => {
        const updatedRace = await tx.race.update({
          where: { id: raceIdInt },
          data: {
            status: "ENDED",
            endTime: now,
            isClosed: 1,
          },
          include: {
            raceType: true,
            seasonRel: { include: { event: true } },
          },
        });

        // Every bird entered in this race, with whether it actually arrived.
        const items = await tx.raceItem.findMany({
          where: { raceId: raceIdInt },
          select: {
            id: true,
            isLost: true,
            inventoryItem: { select: { birdId: true } },
            result: { select: { arrivalTime: true } },
          },
        });

        const toLose: number[] = [];
        const toRecover: number[] = [];
        const birdsToLose: number[] = [];
        const birdsToRecover: number[] = [];

        for (const item of items) {
          const arrived = item.result?.arrivalTime != null;
          const isLost = item.isLost === 1;
          const birdId = item.inventoryItem?.birdId;

          if (!isLost && !arrived) {
            toLose.push(item.id);
            if (birdId != null) birdsToLose.push(birdId);
          } else if (isLost && arrived) {
            toRecover.push(item.id);
            if (birdId != null) birdsToRecover.push(birdId);
          }
        }

        if (toLose.length > 0) {
          await tx.raceItem.updateMany({
            where: { id: { in: toLose } },
            data: { isLost: 1, lostRaceId: raceIdInt, displayStatusId: lostStatusId },
          });
          await tx.bird.updateMany({
            where: { id: { in: birdsToLose } },
            data: { isLost: 1, lostDate: now, lostRaceId: raceIdInt },
          });
          await tx.lostHistory.createMany({
            data: birdsToLose.map((birdId) => ({
              birdId,
              raceId: raceIdInt,
              isLost: 1,
              lostDate: now,
            })),
          });
        }

        if (toRecover.length > 0) {
          await tx.raceItem.updateMany({
            where: { id: { in: toRecover } },
            data: { isLost: 0, lostRaceId: null, displayStatusId: arrivedStatusId },
          });
          await tx.bird.updateMany({
            where: { id: { in: birdsToRecover } },
            data: { isLost: 0, lostDate: null, lostRaceId: null },
          });
          await tx.lostHistory.createMany({
            data: birdsToRecover.map((birdId) => ({
              birdId,
              raceId: raceIdInt,
              isLost: 0,
              lostDate: now,
            })),
          });
        }

        return { updatedRace, lostCount: toLose.length, recoveredCount: toRecover.length };
      },
      { maxWait: 20000, timeout: 180000 }
    );

    // Positions and prizes are only meaningful once the lost set is settled,
    // so this runs after the transaction above commits.
    const recalc = await recalcRace(raceIdInt);

    // Results are final once the recalculation has run, so announce after it.
    await notifyRaceEnded(raceIdInt, lostCount);

    return NextResponse.json(
      {
        race: updatedRace,
        lostCount,
        recoveredCount,
        recalc,
        message: "Race ended successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error ending race:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
