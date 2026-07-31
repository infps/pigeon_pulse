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

  const url = new URL(request.url);
  const seasonIdParam = url.searchParams.get("seasonId");
  let seasonId: number;
  if (seasonIdParam) {
    seasonId = parseInt(seasonIdParam);
  } else {
    const activeSeason = await prisma.season.findFirst({
      where: { eventId, isActive: true },
      orderBy: { startDate: "desc" },
    });
    if (!activeSeason) {
      return NextResponse.json({ message: "No active season for this event" }, { status: 404 });
    }
    seasonId = activeSeason.id;
  }

  const { rfid, targetGroupId } = await request.json();
  if (!rfid || !targetGroupId) return NextResponse.json({ message: "rfid and targetGroupId required" }, { status: 400 });

  const targetGroup = await prisma.eventGroup.findFirst({ where: { id: targetGroupId, seasonId } });
  if (!targetGroup) return NextResponse.json({ message: "Target group not found" }, { status: 404 });

  const bird = await prisma.bird.findFirst({ where: { rfid: rfid.trim() } });
  if (!bird) return NextResponse.json({ message: `No bird with RFID ${rfid}`, notFound: true }, { status: 404 });

  const item = await prisma.eventInventoryItem.findFirst({
    where: { birdId: bird.id, eventInventory: { seasonId } },
    include: { currentGroup: { select: { id: true, name: true } } },
  });
  if (!item) return NextResponse.json({ message: "Bird not registered in this event", notFound: true }, { status: 404 });

  if (item.currentGroupId === targetGroupId) {
    const band = [bird.band1, bird.band2, bird.band3, bird.band4].filter(Boolean).join("-") || bird.band || rfid;
    return NextResponse.json({ alreadyInGroup: true, band, groupName: targetGroup.name });
  }

  const fromGroupName = item.currentGroup?.name ?? null;

  await prisma.$transaction(async (tx) => {
    if (fromGroupName) {
      await tx.birdGroupHistory.create({
        data: { inventoryItemId: item.id, fromGroupName },
      });
    }
    await tx.eventInventoryItem.update({
      where: { id: item.id },
      data: { currentGroupId: targetGroupId },
    });
    await tx.birdEventHistory.create({
      data: {
        eventInventoryItemId: item.id,
        action: "GROUP_MOVED",
        detail: `Scan-moved from "${fromGroupName ?? "none"}" to "${targetGroup.name}"`,
        groupId: targetGroupId,
        performedById: session.user.id,
      },
    });
  });

  const band = [bird.band1, bird.band2, bird.band3, bird.band4].filter(Boolean).join("-") || bird.band || rfid;
  return NextResponse.json({ ok: true, band, fromGroup: fromGroupName, toGroup: targetGroup.name, itemId: item.id });
}
