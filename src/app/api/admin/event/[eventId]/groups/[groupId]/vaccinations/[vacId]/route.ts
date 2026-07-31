import { auth } from "@/lib/auth";
import { deleteFromR2 } from "@/lib/r2";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ eventId: string; groupId: string; vacId: string }> };

async function resolveRecord(seasonId: number, groupId: number, vacId: number) {
  return prisma.vaccinationRecord.findFirst({
    where: { id: vacId, eventGroupId: groupId, eventGroup: { seasonId } },
  });
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
  const { eventId: ep, groupId: gp, vacId: vp } = await params;
  const eventId = parseInt(ep), groupId = parseInt(gp), vacId = parseInt(vp);
  if (isNaN(eventId) || isNaN(groupId) || isNaN(vacId)) {
    return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const seasonId = await resolveSeasonId(request, eventId);
  if (seasonId instanceof NextResponse) return seasonId;

  const record = await resolveRecord(seasonId, groupId, vacId);
  if (!record) return NextResponse.json({ message: "Record not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const { vaccineName, vaccinationDate, vet, batchNo, notes } = body;

  const updated = await prisma.vaccinationRecord.update({
    where: { id: vacId },
    data: {
      ...(vaccineName && { vaccineName }),
      ...(vaccinationDate && { vaccinationDate: new Date(vaccinationDate) }),
      ...(vet !== undefined && { vet }),
      ...(batchNo !== undefined && { batchNo }),
      ...(notes !== undefined && { notes }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request: Request, { params }: Params) {
  const { eventId: ep, groupId: gp, vacId: vp } = await params;
  const eventId = parseInt(ep), groupId = parseInt(gp), vacId = parseInt(vp);
  if (isNaN(eventId) || isNaN(groupId) || isNaN(vacId)) {
    return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const seasonId = await resolveSeasonId(request, eventId);
  if (seasonId instanceof NextResponse) return seasonId;

  const record = await resolveRecord(seasonId, groupId, vacId);
  if (!record) return NextResponse.json({ message: "Record not found" }, { status: 404 });

  if (record.documentKey) {
    try { await deleteFromR2(record.documentKey); } catch { /* ignore */ }
  }

  await prisma.vaccinationRecord.delete({ where: { id: vacId } });
  return NextResponse.json({ message: "Deleted" });
}
