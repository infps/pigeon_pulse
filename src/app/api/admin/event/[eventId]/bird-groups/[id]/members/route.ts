import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

type Params = Promise<{ eventId: string; id: string }>;

async function resolveParams(params: Params) {
  const { eventId: ep, id: ip } = await params;
  const eventId = parseInt(ep);
  const id = parseInt(ip);
  if (isNaN(eventId) || isNaN(id)) return null;
  return { eventId, id };
}

export async function POST(request: Request, { params }: { params: Params }) {
  const p = await resolveParams(params);
  if (!p) return NextResponse.json({ message: "Invalid params" }, { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { eventInventoryItemId } = await request.json();
  if (!eventInventoryItemId) {
    return NextResponse.json({ message: "eventInventoryItemId required" }, { status: 400 });
  }

  const group = await prisma.eventBirdGroup.findFirst({
    where: { id: p.id, eventId: p.eventId },
  });
  if (!group) return NextResponse.json({ message: "Group not found" }, { status: 404 });

  let removedFromGroup: string | null = null;

  const member = await prisma.$transaction(async (tx) => {
    // For TAG_COLOR: enforce uniqueness — remove from any other TAG_COLOR group in this event
    if (group.type === "TAG_COLOR") {
      const existing = await tx.eventBirdGroupMember.findFirst({
        where: {
          eventInventoryItemId,
          group: { eventId: p.eventId, type: "TAG_COLOR", id: { not: p.id } },
        },
        include: { group: { select: { name: true } } },
      });
      if (existing) {
        removedFromGroup = existing.group.name;
        await tx.eventBirdGroupMember.delete({ where: { id: existing.id } });
      }
    }

    return tx.eventBirdGroupMember.create({
      data: { groupId: p.id, eventInventoryItemId },
    });
  });

  return NextResponse.json(
    { member, ...(removedFromGroup ? { removedFromGroup } : {}) },
    { status: 201 }
  );
}

export async function DELETE(request: Request, { params }: { params: Params }) {
  const p = await resolveParams(params);
  if (!p) return NextResponse.json({ message: "Invalid params" }, { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { eventInventoryItemId } = await request.json();
  if (!eventInventoryItemId) {
    return NextResponse.json({ message: "eventInventoryItemId required" }, { status: 400 });
  }

  const result = await prisma.eventBirdGroupMember.deleteMany({
    where: { groupId: p.id, eventInventoryItemId },
  });

  if (result.count === 0) {
    return NextResponse.json({ message: "Member not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Removed" });
}
