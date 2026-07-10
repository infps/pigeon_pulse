import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: ep } = await params;
  const eventId = parseInt(ep);
  if (isNaN(eventId)) return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { eventInventoryItemId, fromGroupId, toGroupId } = await request.json();
  if (!eventInventoryItemId) {
    return NextResponse.json({ message: "eventInventoryItemId required" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    if (fromGroupId) {
      await tx.eventBirdGroupMember.deleteMany({
        where: { groupId: fromGroupId, eventInventoryItemId },
      });
    }

    if (toGroupId) {
      const toGroup = await tx.eventBirdGroup.findUnique({
        where: { id: toGroupId },
        select: { type: true },
      });

      // For TAG_COLOR: remove from any other TAG_COLOR group first
      if (toGroup?.type === "TAG_COLOR") {
        await tx.eventBirdGroupMember.deleteMany({
          where: {
            eventInventoryItemId,
            group: { eventId, type: "TAG_COLOR", id: { not: toGroupId } },
          },
        });
      }

      await tx.eventBirdGroupMember.upsert({
        where: { groupId_eventInventoryItemId: { groupId: toGroupId, eventInventoryItemId } },
        update: {},
        create: { groupId: toGroupId, eventInventoryItemId },
      });
    }
  });

  // Return updated groups state
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
