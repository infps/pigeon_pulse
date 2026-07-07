import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { eventInventoryItemId, rfid } = body;

    if (!eventInventoryItemId || !rfid || typeof rfid !== "string" || rfid.trim() === "") {
      return NextResponse.json(
        { message: "eventInventoryItemId and rfid are required" },
        { status: 400 }
      );
    }

    // Must have an open group
    const activeGroup = await prisma.loftGroup.findFirst({
      where: { eventId, status: "OPEN" },
    });
    if (!activeGroup) {
      return NextResponse.json(
        { message: "No active group. Create a group before scanning." },
        { status: 409 }
      );
    }

    // Validate item belongs to event
    const item = await prisma.eventInventoryItem.findFirst({
      where: {
        id: eventInventoryItemId,
        eventInventory: { eventId },
      },
      include: {
        bird: { select: { id: true, band: true, birdName: true, rfid: true } },
        eventInventory: {
          include: {
            breeder: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!item || !item.bird) {
      return NextResponse.json(
        { message: "Bird not found for this event" },
        { status: 404 }
      );
    }

    // Already assigned to a group?
    if (item.loftGroupId !== null) {
      const existingGroup = await prisma.loftGroup.findUnique({
        where: { id: item.loftGroupId },
        select: { groupNo: true, status: true },
      });
      return NextResponse.json({
        message: `Bird already in Group ${existingGroup?.groupNo ?? item.loftGroupId}`,
        alreadyAssigned: true,
        loftGroupId: item.loftGroupId,
        groupNo: existingGroup?.groupNo,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Link RFID to bird if new
      if (item.bird!.rfid !== rfid.trim()) {
        const existing = await tx.bird.findFirst({
          where: { rfid: rfid.trim(), id: { not: item.bird!.id } },
        });
        if (existing) {
          throw new Error(`RFID "${rfid}" already linked to another bird (ID: ${existing.id})`);
        }
        await tx.bird.update({
          where: { id: item.bird!.id },
          data: { rfid: rfid.trim() },
        });
      }

      // 2. Assign bird to active group
      await tx.eventInventoryItem.update({
        where: { id: item.id },
        data: { loftGroupId: activeGroup.id },
      });

      // 3. Update RaceItem status → LOFT_BASKETED
      await tx.raceItem.updateMany({
        where: {
          inventoryItemId: item.id,
          status: { in: ["REGISTERED", "CHECKED_IN"] },
        },
        data: { status: "LOFT_BASKETED" },
      });

      // 4. Get updated member count
      const memberCount = await tx.eventInventoryItem.count({
        where: { loftGroupId: activeGroup.id },
      });

      const capacityPercent = memberCount / activeGroup.capacity;

      return {
        rfid: rfid.trim(),
        birdId: item.bird!.id,
        loftGroup: {
          id: activeGroup.id,
          groupNo: activeGroup.groupNo,
          memberCount,
          capacity: activeGroup.capacity,
          capacityPercent,
        },
        capacityWarning: capacityPercent >= 0.85,
      };
    });

    return NextResponse.json({
      message: "Bird scanned and assigned to group",
      ...result,
    });
  } catch (error: any) {
    console.error("Error in scan-loft:", error);
    if (error.message?.includes("RFID")) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
