import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ eventId: string; groupId: string }> };

export async function GET(_request: Request, { params }: Params) {
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

  const vaccinations = await prisma.vaccinationRecord.findMany({
    where: { loftGroupId: groupId },
    orderBy: { vaccinationDate: "desc" },
  });

  return NextResponse.json(vaccinations);
}

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
  const { vaccineName, vaccinationDate, vet, batchNo, notes } = body;

  if (!vaccineName || !vaccinationDate) {
    return NextResponse.json({ message: "vaccineName and vaccinationDate required" }, { status: 400 });
  }

  const record = await prisma.vaccinationRecord.create({
    data: {
      loftGroupId: groupId,
      vaccineName,
      vaccinationDate: new Date(vaccinationDate),
      vet: vet ?? null,
      batchNo: batchNo ?? null,
      notes: notes ?? null,
    },
  });

  return NextResponse.json(record, { status: 201 });
}
