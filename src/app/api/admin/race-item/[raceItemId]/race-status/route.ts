import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { presetIdFor } from "@/lib/birdStatus";
import { recalcRace } from "@/lib/race-results";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Set a bird's race status by hand — the operator's route to the states that no
 * scan produces.
 *
 *   IGNORED  the bird did not really fly; drop it from the results
 *   STRAY    a lost bird turned up with a later flock; no position awarded
 *   LOST     lost, recorded as a status rather than only a flag on the bird
 *   ARRIVED  undo the above and put the bird back in the results
 *
 * Any change re-ranks the race, because removing or restoring a bird shifts
 * every position behind it.
 */
const bodySchema = z.object({
  status: z.enum(["IGNORED", "STRAY", "LOST", "ARRIVED"]),
  note: z.string().max(500).optional(),
});

const TRIGGER_FOR: Record<string, "LOST" | "ARRIVE" | "MANUAL"> = {
  LOST: "LOST",
  STRAY: "MANUAL",
  IGNORED: "MANUAL",
  ARRIVED: "ARRIVE",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ raceItemId: string }> }
) {
  try {
    const guard = await requirePermission("races.manage");
    if ("error" in guard) return guard.error;
    const session = guard.session;

    const { raceItemId } = await params;
    const itemId = parseInt(raceItemId, 10);
    if (Number.isNaN(itemId)) {
      return NextResponse.json({ message: "Invalid race item ID" }, { status: 400 });
    }

    const { status, note } = bodySchema.parse(await request.json());

    const raceItem = await prisma.raceItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        raceId: true,
        status: true,
        inventoryItemId: true,
        race: { select: { seasonId: true, status: true } },
        result: { select: { arrivalTime: true } },
      },
    });

    if (!raceItem || raceItem.raceId == null) {
      return NextResponse.json({ message: "Race item not found" }, { status: 404 });
    }

    if (status === "ARRIVED" && raceItem.result?.arrivalTime == null) {
      return NextResponse.json(
        { message: "This bird has no arrival scan, so it cannot be marked as arrived." },
        { status: 400 }
      );
    }

    const displayStatusId = await presetIdFor(
      raceItem.race?.seasonId ?? null,
      TRIGGER_FOR[status]
    );

    await prisma.$transaction(async (tx) => {
      await tx.raceItem.update({
        where: { id: itemId },
        data: {
          status,
          displayStatusId,
          // The lost flag tracks the status so existing reads stay consistent.
          isLost: status === "LOST" ? 1 : 0,
          lostRaceId: status === "LOST" ? raceItem.raceId : null,
        },
      });

      if (raceItem.inventoryItemId != null) {
        await tx.birdEventHistory.create({
          data: {
            eventInventoryItemId: raceItem.inventoryItemId,
            action: "STATUS_CHANGED",
            detail: note
              ? `${raceItem.status} to ${status}: ${note}`
              : `${raceItem.status} to ${status}`,
            performedById: session.user.id ?? null,
          },
        });
      }
    });

    // Positions and prize money shift when a bird leaves or rejoins the results.
    const recalc = await recalcRace(raceItem.raceId);

    return NextResponse.json({
      recalc,
      message: `Bird marked ${status.toLowerCase()}; ${recalc.positionsAssigned} positions re-ranked.`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Status must be one of IGNORED, STRAY, LOST or ARRIVED." },
        { status: 400 }
      );
    }
    console.error("Failed to set race status:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
