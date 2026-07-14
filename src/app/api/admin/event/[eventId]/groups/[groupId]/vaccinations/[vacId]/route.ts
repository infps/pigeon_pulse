import { auth } from "@/lib/auth";
import { deleteFromR2 } from "@/lib/r2";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ eventId: string; groupId: string; vacId: string }> };

async function resolveRecord(eventId: number, groupId: number, vacId: number) {
  return prisma.vaccinationRecord.findFirst({
    where: { id: vacId, eventGroupId: groupId, eventGroup: { eventId } },
  });
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

  const record = await resolveRecord(eventId, groupId, vacId);
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

export async function DELETE(_req: Request, { params }: Params) {
  const { eventId: ep, groupId: gp, vacId: vp } = await params;
  const eventId = parseInt(ep), groupId = parseInt(gp), vacId = parseInt(vp);
  if (isNaN(eventId) || isNaN(groupId) || isNaN(vacId)) {
    return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const record = await resolveRecord(eventId, groupId, vacId);
  if (!record) return NextResponse.json({ message: "Record not found" }, { status: 404 });

  if (record.documentKey) {
    try { await deleteFromR2(record.documentKey); } catch { /* ignore */ }
  }

  await prisma.vaccinationRecord.delete({ where: { id: vacId } });
  return NextResponse.json({ message: "Deleted" });
}
