import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { presetIdFor } from "@/lib/birdStatus";
import { lockRace } from "@/lib/race-results";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const resolveSchema = z.object({
  /** Registered bird this tag actually belongs to. */
  birdId: z.number().int().positive(),
  /** Attach the tag to the bird's record so future scans match automatically. */
  linkRfid: z.boolean().optional().default(true),
  /** Record the phantom's timestamp as the bird's arrival in this race. */
  recordArrival: z.boolean().optional().default(true),
});

/**
 * Resolve a phantom scan by matching it to a registered bird.
 *
 * With recordArrival the bird is marked ARRIVED at the phantom's timestamp and
 * a result row is created. Positions are deliberately NOT assigned here —
 * inserting an arrival in the middle of a finished race shifts everyone behind
 * it, so the operator runs a recalculation afterwards and sees the shift first.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ raceId: string; phantomId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { raceId, phantomId } = await params;
    const raceIdInt = parseInt(raceId);
    const phantomIdInt = parseInt(phantomId);
    if (Number.isNaN(raceIdInt) || Number.isNaN(phantomIdInt)) {
      return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();
    const { birdId, linkRfid, recordArrival } = resolveSchema.parse(body);

    const phantom = await prisma.racePhantomBird.findUnique({
      where: { id: phantomIdInt },
    });
    if (!phantom || phantom.raceId !== raceIdInt) {
      return NextResponse.json({ message: "Phantom scan not found" }, { status: 404 });
    }

    const raceItem = await prisma.raceItem.findFirst({
      where: { raceId: raceIdInt, inventoryItem: { birdId } },
      include: { result: true, inventoryItem: { select: { id: true } } },
    });

    if (!raceItem) {
      return NextResponse.json(
        {
          message:
            "That bird is not entered in this race, so the scan cannot be recorded against it.",
        },
        { status: 400 }
      );
    }

    const arrivedStatusId = await presetIdFor(phantom.raceId, "ARRIVE");

    const result = await prisma.$transaction(async (tx) => {
      await lockRace(tx, raceIdInt);

      if (linkRfid && phantom.rfid) {
        // Only claim the tag if no other bird already holds it.
        const holder = await tx.bird.findFirst({
          where: { rfid: phantom.rfid, NOT: { id: birdId } },
          select: { id: true },
        });
        if (!holder) {
          await tx.bird.update({ where: { id: birdId }, data: { rfid: phantom.rfid } });
        }
      }

      let recorded = false;
      if (recordArrival && phantom.arrivalTime) {
        await tx.raceItem.update({
          where: { id: raceItem.id },
          data: {
            status: "ARRIVED",
            isLost: 0,
            raceBasketTime: phantom.arrivalTime,
            displayStatusId: arrivedStatusId,
          },
        });
        await tx.raceItemResult.upsert({
          where: { raceItemId: raceItem.id },
          create: { raceItemId: raceItem.id, arrivalTime: phantom.arrivalTime },
          update: { arrivalTime: phantom.arrivalTime },
        });
        recorded = true;
      }

      await tx.racePhantomBird.update({
        where: { id: phantomIdInt },
        data: { birdId },
      });

      if (raceItem.inventoryItem?.id) {
        await tx.birdEventHistory.create({
          data: {
            eventInventoryItemId: raceItem.inventoryItem.id,
            action: recorded ? "ARRIVED" : "STATUS_CHANGED",
            detail: `Phantom scan ${phantom.rfid ?? phantomIdInt} matched to this bird${
              recorded ? ` (arrival ${phantom.arrivalTime?.toISOString()})` : ""
            }`,
            performedById: session.user.id ?? null,
          },
        });
      }

      return { recorded };
    });

    return NextResponse.json({
      message: result.recorded
        ? "Scan matched and arrival recorded. Recalculate the race to update positions."
        : "Scan matched to the bird.",
      recordedArrival: result.recorded,
      needsRecalculation: result.recorded,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Invalid request", issues: error.issues }, { status: 400 });
    }
    console.error("Error resolving phantom scan:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

/** Dismiss a phantom scan that does not correspond to a bird in this race. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ raceId: string; phantomId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { raceId, phantomId } = await params;
    const raceIdInt = parseInt(raceId);
    const phantomIdInt = parseInt(phantomId);
    if (Number.isNaN(raceIdInt) || Number.isNaN(phantomIdInt)) {
      return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
    }

    const phantom = await prisma.racePhantomBird.findUnique({ where: { id: phantomIdInt } });
    if (!phantom || phantom.raceId !== raceIdInt) {
      return NextResponse.json({ message: "Phantom scan not found" }, { status: 404 });
    }

    await prisma.racePhantomBird.delete({ where: { id: phantomIdInt } });

    return NextResponse.json({ message: "Scan dismissed" });
  } catch (error) {
    console.error("Error dismissing phantom scan:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
