import { auth } from "@/lib/auth";
import { uploadToR2, deleteFromR2, generateImageKey } from "@/lib/r2";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ eventId: string; groupId: string; vacId: string }> };

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

async function resolveRecord(seasonId: number, groupId: number, vacId: number) {
  return prisma.vaccinationRecord.findFirst({
    where: { id: vacId, eventGroupId: groupId, eventGroup: { seasonId } },
  });
}

export async function POST(request: Request, { params }: Params) {
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

  const formData = await request.formData();
  const file = formData.get("document") as File | null;
  if (!file) return NextResponse.json({ message: "No document provided" }, { status: 400 });

  if (record.documentKey) {
    try { await deleteFromR2(record.documentKey); } catch { /* ignore */ }
  }

  const key = generateImageKey("vaccination-docs", file.name);
  const { url } = await uploadToR2(file, key);

  const updated = await prisma.vaccinationRecord.update({
    where: { id: vacId },
    data: { documentUrl: url, documentKey: key },
  });

  return NextResponse.json({ documentUrl: updated.documentUrl, documentKey: updated.documentKey });
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

  await prisma.vaccinationRecord.update({
    where: { id: vacId },
    data: { documentUrl: null, documentKey: null },
  });

  return NextResponse.json({ message: "Document removed" });
}
