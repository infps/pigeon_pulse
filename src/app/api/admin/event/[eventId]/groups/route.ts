import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

async function resolveEventId(params: Promise<{ eventId: string }>) {
  const { eventId: p } = await params;
  const id = parseInt(p);
  return isNaN(id) ? null : id;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const eventId = await resolveEventId(params);
  if (!eventId) return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const groups = await prisma.eventGroup.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
    include: {
      statusCode: { select: { id: true, code: true, label: true, color: true } },
      _count: { select: { members: true, vaccinations: true } },
      vaccinations: { orderBy: { vaccinationDate: "desc" } },
      members: {
        select: {
          id: true,
          currentGroupId: true,
          bird: {
            select: { id: true, band: true, band1: true, band2: true, band3: true, band4: true, color: true },
          },
          eventInventory: {
            select: {
              breeder: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          groupHistory: { orderBy: { movedAt: "desc" }, select: { fromGroupName: true, movedAt: true } },
          breederHistory: { orderBy: { transferredAt: "desc" }, select: { fromBreederName: true, transferredAt: true } },
        },
      },
    },
  });

  return NextResponse.json({ groups });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const eventId = await resolveEventId(params);
  if (!eventId) return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { name, type = "LOFT", color, statusCodeId, notes, hasCapacity = true, capacity } = body;

  if (!name) return NextResponse.json({ message: "name is required" }, { status: 400 });

  const group = await prisma.eventGroup.create({
    data: {
      eventId,
      name,
      type,
      color: color || null,
      statusCodeId: statusCodeId ? parseInt(statusCodeId) : null,
      notes: notes || null,
      hasCapacity,
      capacity: hasCapacity ? (typeof capacity === "number" ? capacity : 150) : null,
    },
  });

  return NextResponse.json({ group }, { status: 201 });
}
