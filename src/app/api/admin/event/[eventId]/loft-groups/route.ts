import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: eventIdParam } = await params;
  const eventId = parseInt(eventIdParam);
  if (isNaN(eventId)) return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const groups = await prisma.loftGroup.findMany({
    where: { eventId },
    orderBy: { groupNo: "asc" },
    include: {
      _count: { select: { members: true, vaccinations: true } },
      vaccinations: {
        orderBy: { vaccinationDate: "desc" },
      },
      members: {
        select: {
          id: true,
          bird: {
            select: { id: true, band: true, band1: true, band2: true, band3: true, band4: true, color: true },
          },
          eventInventory: {
            select: {
              breeder: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });

  return NextResponse.json(groups);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: eventIdParam } = await params;
  const eventId = parseInt(eventIdParam);
  if (isNaN(eventId)) return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // Only one OPEN group at a time
  const existingOpen = await prisma.loftGroup.findFirst({
    where: { eventId, status: "OPEN" },
  });
  if (existingOpen) {
    return NextResponse.json(
      { message: `Group ${existingOpen.groupNo} is still open. Close it first.` },
      { status: 409 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const capacity = typeof body.capacity === "number" ? body.capacity : 150;

  const lastGroup = await prisma.loftGroup.findFirst({
    where: { eventId },
    orderBy: { groupNo: "desc" },
  });
  const groupNo = (lastGroup?.groupNo ?? 0) + 1;

  const group = await prisma.loftGroup.create({
    data: { eventId, groupNo, capacity, status: "OPEN" },
  });

  return NextResponse.json(group, { status: 201 });
}
