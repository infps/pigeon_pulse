import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ eventId: string; groupId: string }> };

async function resolveParams(params: Promise<{ eventId: string; groupId: string }>) {
  const { eventId: ep, groupId: gp } = await params;
  const eventId = parseInt(ep);
  const groupId = parseInt(gp);
  if (isNaN(eventId) || isNaN(groupId)) return null;
  return { eventId, groupId };
}

// Bulk-add birds to group
export async function POST(request: Request, { params }: Params) {
  const p = await resolveParams(params);
  if (!p) return NextResponse.json({ message: "Invalid ID" }, { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const group = await prisma.eventGroup.findFirst({ where: { id: p.groupId, eventId: p.eventId } });
  if (!group) return NextResponse.json({ message: "Group not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const itemIds: number[] = Array.isArray(body.eventInventoryItemIds)
    ? body.eventInventoryItemIds.map(Number).filter(Boolean)
    : [];

  if (itemIds.length === 0) return NextResponse.json({ message: "No item IDs provided" }, { status: 400 });

  const items = await prisma.eventInventoryItem.findMany({
    where: { id: { in: itemIds }, eventInventory: { eventId: p.eventId } },
    select: { id: true, currentGroupId: true },
  });

  if (items.length !== itemIds.length) {
    return NextResponse.json({ message: "Some items not found in this event" }, { status: 404 });
  }

  if (group.hasCapacity && group.capacity !== null) {
    const currentCount = await prisma.eventInventoryItem.count({ where: { currentGroupId: p.groupId } });
    if (currentCount + items.length > group.capacity) {
      return NextResponse.json(
        { message: `Exceeds capacity. Current: ${currentCount}, capacity: ${group.capacity}` },
        { status: 409 }
      );
    }
  }

  await prisma.eventInventoryItem.updateMany({
    where: { id: { in: items.map((i) => i.id) } },
    data: { currentGroupId: p.groupId },
  });

  await prisma.birdEventHistory.createMany({
    data: items.map((i) => ({
      eventInventoryItemId: i.id,
      action: "GROUP_ASSIGNED" as const,
      detail: `Added to group: ${group.name} (${group.type})`,
      groupId: group.id,
      performedById: session.user.id,
    })),
  });

  const memberCount = await prisma.eventInventoryItem.count({ where: { currentGroupId: p.groupId } });

  return NextResponse.json({ added: items.length, memberCount });
}

// Remove single bird from group
export async function DELETE(request: Request, { params }: Params) {
  const p = await resolveParams(params);
  if (!p) return NextResponse.json({ message: "Invalid ID" }, { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const itemId = parseInt(body.eventInventoryItemId);
  if (isNaN(itemId)) return NextResponse.json({ message: "Invalid item ID" }, { status: 400 });

  const item = await prisma.eventInventoryItem.findFirst({
    where: { id: itemId, currentGroupId: p.groupId, eventInventory: { eventId: p.eventId } },
  });
  if (!item) return NextResponse.json({ message: "Item not found in group" }, { status: 404 });

  const group = await prisma.eventGroup.findUnique({ where: { id: p.groupId }, select: { name: true, type: true } });

  await prisma.eventInventoryItem.update({
    where: { id: itemId },
    data: { currentGroupId: null },
  });

  await prisma.birdEventHistory.create({
    data: {
      eventInventoryItemId: itemId,
      action: "GROUP_REMOVED",
      detail: `Removed from group: ${group?.name ?? p.groupId} (${group?.type ?? ""})`,
      groupId: p.groupId,
      performedById: session.user.id,
    },
  });

  return NextResponse.json({ message: "Removed from group" });
}
