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

  const groups = await prisma.eventBirdGroup.findMany({
    where: { eventId },
    include: {
      statusCode: { select: { id: true, code: true, label: true, color: true } },
      members: {
        include: {
          eventInventoryItem: {
            include: {
              bird: { select: { id: true, band: true, band1: true, band2: true, band3: true, band4: true, color: true } },
              eventInventory: {
                include: {
                  breeder: { select: { id: true, firstName: true, lastName: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
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

  const { name, type, color, statusCodeId, notes } = await request.json();
  if (!name || !type) {
    return NextResponse.json({ message: "name and type are required" }, { status: 400 });
  }

  const group = await prisma.eventBirdGroup.create({
    data: {
      eventId,
      name,
      type,
      color: color || null,
      statusCodeId: statusCodeId ? parseInt(statusCodeId) : null,
      notes: notes || null,
    },
  });

  return NextResponse.json({ group }, { status: 201 });
}
