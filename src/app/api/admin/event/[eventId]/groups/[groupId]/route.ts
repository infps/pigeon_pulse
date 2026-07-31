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

async function resolveSeasonId(request: Request, eventId: number): Promise<number | NextResponse> {
  const { searchParams } = new URL(request.url);
  const seasonIdParam = searchParams.get("seasonId");
  if (seasonIdParam) return parseInt(seasonIdParam);
  const activeSeason = await prisma.season.findFirst({
    where: { eventId, isActive: true },
    orderBy: { startDate: "desc" },
  });
  if (!activeSeason) {
    return NextResponse.json({ message: "No active season for this event" }, { status: 404 });
  }
  return activeSeason.id;
}

export async function PATCH(request: Request, { params }: Params) {
  const p = await resolveParams(params);
  if (!p) return NextResponse.json({ message: "Invalid ID" }, { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const seasonId = await resolveSeasonId(request, p.eventId);
  if (seasonId instanceof NextResponse) return seasonId;

  const group = await prisma.eventGroup.findFirst({ where: { id: p.groupId, seasonId } });
  if (!group) return NextResponse.json({ message: "Group not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (body.name !== undefined) data.name = body.name;
  if (body.type !== undefined) data.type = body.type;
  if (body.color !== undefined) data.color = body.color || null;
  if (body.notes !== undefined) data.notes = body.notes || null;
  if (body.statusCodeId !== undefined) data.statusCodeId = body.statusCodeId ? parseInt(body.statusCodeId) : null;
  if (body.hasCapacity !== undefined) {
    data.hasCapacity = body.hasCapacity;
    if (!body.hasCapacity) data.capacity = null;
  }
  if (body.capacity !== undefined && typeof body.capacity === "number" && body.capacity > 0) {
    data.capacity = body.capacity;
  }
  if (body.status !== undefined) data.status = body.status;

  const updated = await prisma.eventGroup.update({ where: { id: p.groupId }, data });
  return NextResponse.json({ group: updated });
}

export async function DELETE(request: Request, { params }: Params) {
  const p = await resolveParams(params);
  if (!p) return NextResponse.json({ message: "Invalid ID" }, { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const seasonId = await resolveSeasonId(request, p.eventId);
  if (seasonId instanceof NextResponse) return seasonId;

  const group = await prisma.eventGroup.findFirst({ where: { id: p.groupId, seasonId } });
  if (!group) return NextResponse.json({ message: "Group not found" }, { status: 404 });

  await prisma.$transaction([
    prisma.eventInventoryItem.updateMany({
      where: { currentGroupId: p.groupId },
      data: { currentGroupId: null },
    }),
    prisma.eventGroup.delete({ where: { id: p.groupId } }),
  ]);

  return NextResponse.json({ message: "Group deleted" });
}
