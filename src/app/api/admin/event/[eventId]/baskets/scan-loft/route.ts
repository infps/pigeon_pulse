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
    const { eventInventoryItemId, rfid, groupId: groupIdOverride } = body;

    if (!rfid || typeof rfid !== "string" || rfid.trim() === "") {
      return NextResponse.json({ message: "rfid is required" }, { status: 400 });
    }

    // Use override group if provided, else find OPEN loft group for season
    const activeGroup = groupIdOverride
      ? await prisma.eventGroup.findFirst({ where: { id: groupIdOverride, seasonId, type: "LOFT" } })
      : await prisma.eventGroup.findFirst({ where: { seasonId, type: "LOFT", status: "OPEN" } });
    if (!activeGroup) {
      return NextResponse.json(
        { message: "No active loft group. Create a LOFT group before scanning." },
        { status: 409 }
      );
    }

    // Look up item: by explicit id OR by rfid tag on the bird
    const itemWhere = eventInventoryItemId
      ? { id: eventInventoryItemId, eventInventory: { seasonId } }
      : { bird: { rfid: rfid.trim() }, eventInventory: { seasonId } };

    const item = await prisma.eventInventoryItem.findFirst({
      where: itemWhere,
      include: {
        bird: { select: { id: true, band: true, birdName: true, rfid: true } },
        currentGroup: { select: { id: true, name: true } },
        eventInventory: {
          include: {
            breeder: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!item || !item.bird) {
      return NextResponse.json(
        { message: `No bird with RFID ${rfid.trim()} registered in this event`, foreign: true },
        { status: 404 }
      );
    }

    // Already assigned to a group?
    if (item.currentGroupId !== null) {
      return NextResponse.json({
        message: `Bird already in group "${item.currentGroup?.name ?? item.currentGroupId}"`,
        alreadyAssigned: true,
        groupId: item.currentGroupId,
        groupName: item.currentGroup?.name,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Link RFID to bird if new
      const rfidChanged = item.bird!.rfid !== rfid.trim();
      if (rfidChanged) {
        await tx.bird.update({
          where: { id: item.bird!.id },
          data: { rfid: rfid.trim() },
        });
      }

      // 2. Assign bird to active LOFT group
      await tx.eventInventoryItem.update({
        where: { id: item.id },
        data: { currentGroupId: activeGroup.id },
      });

      // 2b. If active TAG_COLOR group exists → assign bird there too
      const activeTagGroup = await tx.eventGroup.findFirst({
        where: { seasonId, type: "TAG_COLOR", isActive: true },
      });
      if (activeTagGroup) {
        await tx.eventInventoryItem.update({
          where: { id: item.id },
          data: { tagColorGroupId: activeTagGroup.id },
        });
      }

      // 3. Update RaceItem status → LOFT_BASKETED
      await tx.raceItem.updateMany({
        where: {
          inventoryItemId: item.id,
          status: { in: ["REGISTERED", "CHECKED_IN"] },
        },
        data: { status: "LOFT_BASKETED" },
      });

      // 4. Write BirdEventHistory entries
      if (rfidChanged) {
        await tx.birdEventHistory.create({
          data: {
            eventInventoryItemId: item.id,
            action: "RFID_LINKED",
            detail: `RFID linked: ${rfid.trim()}`,
            performedById: session.user.id,
          },
        });
      }

      await tx.birdEventHistory.create({
        data: {
          eventInventoryItemId: item.id,
          action: "BASKET_ASSIGNED",
          detail: `Assigned to loft group: ${activeGroup.name}`,
          groupId: activeGroup.id,
          performedById: session.user.id,
        },
      });

      if (activeTagGroup) {
        await tx.birdEventHistory.create({
          data: {
            eventInventoryItemId: item.id,
            action: "GROUP_ASSIGNED",
            detail: `Auto-assigned to TAG_COLOR group: ${activeTagGroup.name}`,
            groupId: activeTagGroup.id,
            performedById: session.user.id,
          },
        });
      }

      // 5. Get updated member count
      const memberCount = await tx.eventInventoryItem.count({
        where: { currentGroupId: activeGroup.id },
      });

      const capacityPercent = activeGroup.capacity ? memberCount / activeGroup.capacity : 0;

      return {
        rfid: rfid.trim(),
        birdId: item.bird!.id,
        group: {
          id: activeGroup.id,
          name: activeGroup.name,
          memberCount,
          capacity: activeGroup.capacity,
          capacityPercent,
        },
        ...(activeTagGroup && {
          tagColorGroup: {
            id: activeTagGroup.id,
            name: activeTagGroup.name,
          },
        }),
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
