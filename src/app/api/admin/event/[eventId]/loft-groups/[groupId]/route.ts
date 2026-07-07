import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ eventId: string; groupId: string }> };

async function getGroupOrFail(eventId: number, groupId: number) {
  return prisma.loftGroup.findFirst({ where: { id: groupId, eventId } });
}

export async function PATCH(request: Request, { params }: Params) {
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

  const group = await getGroupOrFail(eventId, groupId);
  if (!group) return NextResponse.json({ message: "Group not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const data: { status?: "OPEN" | "CLOSED"; capacity?: number; closedAt?: Date | null } = {};

  if (body.status === "CLOSED" && group.status === "OPEN") {
    // Reopening check: only one OPEN group allowed
    data.status = "CLOSED";
    data.closedAt = new Date();
  } else if (body.status === "OPEN" && group.status === "CLOSED") {
    // Check no other group is OPEN
    const otherOpen = await prisma.loftGroup.findFirst({
      where: { eventId, status: "OPEN", id: { not: groupId } },
    });
    if (otherOpen) {
      return NextResponse.json(
        { message: `Group ${otherOpen.groupNo} is already open. Close it first.` },
        { status: 409 }
      );
    }
    data.status = "OPEN";
    data.closedAt = null;
  }

  if (typeof body.capacity === "number" && body.capacity > 0) {
    data.capacity = body.capacity;
  }

  const updated = await prisma.loftGroup.update({ where: { id: groupId }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Params) {
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

  const group = await getGroupOrFail(eventId, groupId);
  if (!group) return NextResponse.json({ message: "Group not found" }, { status: 404 });

  // Null out loftGroupId on all members, then delete group (cascades vaccinations)
  await prisma.$transaction([
    prisma.eventInventoryItem.updateMany({
      where: { loftGroupId: groupId },
      data: { loftGroupId: null },
    }),
    prisma.loftGroup.delete({ where: { id: groupId } }),
  ]);

  return NextResponse.json({ message: "Group deleted" });
}
