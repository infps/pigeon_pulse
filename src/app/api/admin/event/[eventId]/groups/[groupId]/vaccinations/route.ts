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

export async function GET(request: Request, { params }: Params) {
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

  const vaccinations = await prisma.vaccinationRecord.findMany({
    where: { eventGroupId: p.groupId },
    orderBy: { vaccinationDate: "desc" },
    include: { birdRecords: { select: { inventoryItemId: true } } },
  });

  return NextResponse.json(vaccinations);
}

export async function POST(request: Request, { params }: Params) {
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
  const { vaccineName, vaccinationDate, vet, batchNo, notes } = body;

  if (!vaccineName || !vaccinationDate) {
    return NextResponse.json({ message: "vaccineName and vaccinationDate required" }, { status: 400 });
  }

  // Get current members for snapshot
  const currentMembers = await prisma.eventInventoryItem.findMany({
    where: { currentGroupId: p.groupId },
    select: { id: true },
  });

  const record = await prisma.$transaction(async (tx) => {
    const vac = await tx.vaccinationRecord.create({
      data: {
        eventGroupId: p.groupId,
        vaccineName,
        vaccinationDate: new Date(vaccinationDate),
        vet: vet ?? null,
        batchNo: batchNo ?? null,
        notes: notes ?? null,
      },
    });

    // Snapshot: one BirdVaccinationRecord per current member
    if (currentMembers.length > 0) {
      await tx.birdVaccinationRecord.createMany({
        data: currentMembers.map((m) => ({
          vaccinationRecordId: vac.id,
          inventoryItemId: m.id,
        })),
        skipDuplicates: true,
      });
    }

    return vac;
  });

  return NextResponse.json(record, { status: 201 });
}
