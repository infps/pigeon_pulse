import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ eventId: string; groupId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { eventId: eventIdParam, groupId: groupIdParam } = await params;
  const eventId = parseInt(eventIdParam);
  const groupId = parseInt(groupIdParam);
  if (isNaN(eventId) || isNaN(groupId)) {
    return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const group = await prisma.loftGroup.findFirst({ where: { id: groupId, eventId } });
  if (!group) return NextResponse.json({ message: "Group not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const itemIds: number[] = Array.isArray(body.eventInventoryItemIds)
    ? body.eventInventoryItemIds.map(Number).filter(Boolean)
    : [];

  if (itemIds.length === 0) {
    return NextResponse.json({ message: "No item IDs provided" }, { status: 400 });
  }

  // Validate items belong to this event
  const items = await prisma.eventInventoryItem.findMany({
    where: {
      id: { in: itemIds },
      eventInventory: { eventId },
    },
    select: { id: true, loftGroupId: true },
  });

  if (items.length !== itemIds.length) {
    return NextResponse.json({ message: "Some items not found in this event" }, { status: 404 });
  }

  const currentCount = await prisma.eventInventoryItem.count({ where: { loftGroupId: groupId } });
  const newTotal = currentCount + items.length;
  const capacityPercent = newTotal / group.capacity;

  await prisma.eventInventoryItem.updateMany({
    where: { id: { in: items.map((i) => i.id) } },
    data: { loftGroupId: groupId },
  });

  return NextResponse.json({
    added: items.length,
    memberCount: newTotal,
    capacity: group.capacity,
    capacityPercent,
    capacityWarning: capacityPercent >= 0.85,
  });
}

export async function DELETE(request: Request, { params }: Params) {
  const { eventId: eventIdParam, groupId: groupIdParam } = await params;
  const eventId = parseInt(eventIdParam);
  const groupId = parseInt(groupIdParam);
  if (isNaN(eventId) || isNaN(groupId)) {
    return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const itemId = parseInt(body.eventInventoryItemId);
  if (isNaN(itemId)) return NextResponse.json({ message: "Invalid item ID" }, { status: 400 });

  const item = await prisma.eventInventoryItem.findFirst({
    where: { id: itemId, loftGroupId: groupId, eventInventory: { eventId } },
  });
  if (!item) return NextResponse.json({ message: "Item not found in group" }, { status: 404 });

  await prisma.eventInventoryItem.update({
    where: { id: itemId },
    data: { loftGroupId: null },
  });

  return NextResponse.json({ message: "Removed from group" });
}
