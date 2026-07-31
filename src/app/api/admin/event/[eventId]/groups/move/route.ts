import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: ep } = await params;
  const eventId = parseInt(ep);
  if (isNaN(eventId)) return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });

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

  const { eventInventoryItemId, toGroupId } = await request.json();
  if (!eventInventoryItemId || !toGroupId) {
    return NextResponse.json({ message: "eventInventoryItemId and toGroupId required" }, { status: 400 });
  }

  const item = await prisma.eventInventoryItem.findFirst({
    where: { id: eventInventoryItemId, eventInventory: { seasonId } },
    include: {
      currentGroup: { select: { name: true } },
      eventInventory: {
        include: { breeder: { select: { firstName: true, lastName: true } } },
      },
    },
  });
  if (!item) return NextResponse.json({ message: "Item not found" }, { status: 404 });

  const toGroup = await prisma.eventGroup.findFirst({
    where: { id: toGroupId, seasonId },
  });
  if (!toGroup) return NextResponse.json({ message: "Target group not found" }, { status: 404 });

  if (toGroup.hasCapacity && toGroup.capacity !== null) {
    const currentCount = await prisma.eventInventoryItem.count({ where: { currentGroupId: toGroupId } });
    if (currentCount >= toGroup.capacity) {
      return NextResponse.json({ message: `Target group at capacity (${toGroup.capacity})` }, { status: 409 });
    }
  }

  await prisma.$transaction(async (tx) => {
    // Record group history if coming from a group
    if (item.currentGroup) {
      await tx.birdGroupHistory.create({
        data: {
          inventoryItemId: eventInventoryItemId,
          fromGroupName: item.currentGroup.name,
        },
      });
    }

    // Move bird
    await tx.eventInventoryItem.update({
      where: { id: eventInventoryItemId },
      data: { currentGroupId: toGroupId },
    });

    // Auto-transfer breeder if moving to DEFAULTER group — write history only
    // (actual breeder reassignment done via transfer-breeder route)
    if (toGroup.type === "DEFAULTER" && item.eventInventory?.breeder) {
      const breeder = item.eventInventory.breeder;
      const name = [breeder.firstName, breeder.lastName].filter(Boolean).join(" ");
      await tx.birdBreederHistory.create({
        data: {
          inventoryItemId: eventInventoryItemId,
          fromBreederName: name,
        },
      });
    }

    await tx.birdEventHistory.create({
      data: {
        eventInventoryItemId,
        action: "GROUP_MOVED",
        detail: `Moved from group "${item.currentGroup?.name ?? "none"}" to "${toGroup.name}"`,
        groupId: toGroup.id,
        performedById: session.user.id,
      },
    });
  });

  return NextResponse.json({ message: "Moved" });
}
