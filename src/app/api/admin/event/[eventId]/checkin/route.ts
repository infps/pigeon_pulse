import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { presetIdFor } from "@/lib/birdStatus";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: eventIdParam } = await params;
  const eventId = parseInt(eventIdParam);

  if (isNaN(eventId)) {
    return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
  }

  try {
    const guard = await requirePermission("checkin.manage");
    if ("error" in guard) return guard.error;
    const session = guard.session;

    const url = new URL(request.url);
    const seasonIdParam = url.searchParams.get("seasonId");
    let seasonId: number;
    if (seasonIdParam) {
      seasonId = parseInt(seasonIdParam);
    } else {
      const activeSeason = await prisma.season.findFirst({
        where: { eventId, isActive: true },
        orderBy: { startDate: "desc" },
      });
      if (!activeSeason) {
        return NextResponse.json({ message: "No active season for this event" }, { status: 404 });
      }
      seasonId = activeSeason.id;
    }

    const body = await request.json();
    const { eventInventoryItemId, rfid } = body;

    if (!eventInventoryItemId || !rfid || typeof rfid !== "string" || rfid.trim() === "") {
      return NextResponse.json(
        { message: "eventInventoryItemId and rfid are required" },
        { status: 400 }
      );
    }

    // Validate item belongs to this season
    const item = await prisma.eventInventoryItem.findFirst({
      where: {
        id: eventInventoryItemId,
        eventInventory: { seasonId },
      },
      include: { bird: { select: { id: true } } },
    });

    if (!item || !item.bird) {
      return NextResponse.json(
        { message: "Bird not found for this event" },
        { status: 404 }
      );
    }

    const checkedInStatusId = await presetIdFor(seasonId, "CHECKIN");

    // Linking the tag is what check-in means, so persist the status here
    // instead of recomputing "has RFID and has paid" on every read. Only
    // races that have not started yet move: a started race has already
    // pushed its birds past this point.
    const { promoted } = await prisma.$transaction(async (tx) => {
      await tx.bird.update({
        where: { id: item.bird!.id },
        data: { rfid: rfid.trim() },
      });

      const result = await tx.raceItem.updateMany({
        where: {
          inventoryItemId: item.id,
          status: "REGISTERED",
          race: { status: "REGISTERING" },
        },
        data: { status: "CHECKED_IN", displayStatusId: checkedInStatusId },
      });

      await tx.birdEventHistory.create({
        data: {
          eventInventoryItemId: item.id,
          action: "RFID_LINKED",
          detail: `RFID ${rfid.trim()} linked at check-in`,
          performedById: session.user.id ?? null,
        },
      });

      return { promoted: result.count };
    });

    return NextResponse.json({
      message: "RFID linked successfully",
      birdId: item.bird.id,
      rfid: rfid.trim(),
      checkedInRaces: promoted,
    });
  } catch (error) {
    console.error("Error linking RFID:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: eventIdParam } = await params;
  const eventId = parseInt(eventIdParam);

  if (isNaN(eventId)) {
    return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
  }

  try {
    const guard = await requirePermission("checkin.manage");
    if ("error" in guard) return guard.error;
    const session = guard.session;

    const url = new URL(request.url);
    const seasonIdParam = url.searchParams.get("seasonId");
    let seasonId: number;
    if (seasonIdParam) {
      seasonId = parseInt(seasonIdParam);
    } else {
      const activeSeason = await prisma.season.findFirst({
        where: { eventId, isActive: true },
        orderBy: { startDate: "desc" },
      });
      if (!activeSeason) {
        return NextResponse.json({ message: "No active season for this event" }, { status: 404 });
      }
      seasonId = activeSeason.id;
    }

    const body = await request.json();
    const { eventInventoryItemId } = body;

    if (!eventInventoryItemId) {
      return NextResponse.json(
        { message: "eventInventoryItemId is required" },
        { status: 400 }
      );
    }

    const item = await prisma.eventInventoryItem.findFirst({
      where: {
        id: eventInventoryItemId,
        eventInventory: { seasonId },
      },
      include: { bird: { select: { id: true } } },
    });

    if (!item || !item.bird) {
      return NextResponse.json(
        { message: "Bird not found for this event" },
        { status: 404 }
      );
    }

    // Unlinking the tag undoes check-in for races that have not started.
    const registeredStatusId = await presetIdFor(seasonId, "REGISTER");
    const { reverted } = await prisma.$transaction(async (tx) => {
      await tx.bird.update({
        where: { id: item.bird!.id },
        data: { rfid: null },
      });

      const result = await tx.raceItem.updateMany({
        where: {
          inventoryItemId: item.id,
          status: "CHECKED_IN",
          race: { status: "REGISTERING" },
        },
        data: { status: "REGISTERED", displayStatusId: registeredStatusId },
      });

      return { reverted: result.count };
    });

    return NextResponse.json({
      message: "RFID unlinked successfully",
      birdId: item.bird.id,
      revertedRaces: reverted,
    });
  } catch (error) {
    console.error("Error unlinking RFID:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
