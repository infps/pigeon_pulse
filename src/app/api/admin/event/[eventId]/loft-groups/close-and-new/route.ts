import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

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

  const body = await request.json().catch(() => ({}));
  const capacity = typeof body.capacity === "number" ? body.capacity : 150;

  const openGroup = await prisma.loftGroup.findFirst({
    where: { eventId, status: "OPEN" },
  });

  const result = await prisma.$transaction(async (tx) => {
    let closedGroup = null;

    if (openGroup) {
      closedGroup = await tx.loftGroup.update({
        where: { id: openGroup.id },
        data: { status: "CLOSED", closedAt: new Date() },
      });
    }

    const lastGroup = await tx.loftGroup.findFirst({
      where: { eventId },
      orderBy: { groupNo: "desc" },
    });
    const groupNo = (lastGroup?.groupNo ?? 0) + 1;

    const newGroup = await tx.loftGroup.create({
      data: { eventId, groupNo, capacity, status: "OPEN" },
    });

    return { closedGroup, newGroup };
  });

  return NextResponse.json(result, { status: 201 });
}
