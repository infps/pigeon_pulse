import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusher } from "@/lib/pusher";
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

  const config = await prisma.calcuttaConfig.findUnique({ where: { seasonId } });
  if (!config || !config.activeGroupId) {
    return NextResponse.json({ message: "No active group" }, { status: 409 });
  }

  const groupId = config.activeGroupId;

  const group = await prisma.calcuttaBetGroup.findUnique({
    where: { id: groupId },
    include: {
      bids: { orderBy: { amount: "desc" }, take: 1, include: { bidder: { select: { id: true, name: true } } } },
    },
  });
  if (!group) return NextResponse.json({ message: "Group not found" }, { status: 404 });

  // Anti-snipe check
  if (group.lastBidAt) {
    const elapsed = Date.now() - group.lastBidAt.getTime();
    const antiSnipeMs = config.antiSnipeDuration * 1000;
    if (elapsed < antiSnipeMs) {
      return NextResponse.json(
        { error: "Anti-snipe active", remainingMs: antiSnipeMs - elapsed },
        { status: 409 }
      );
    }
  }

  const topBid = group.bids[0];

  if (!topBid) {
    // No bids — leave as BIDDING, admin must set-house or reprice
    return NextResponse.json({ message: "No bids placed. Use set-house or reprice." }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.calcuttaBetGroup.update({
      where: { id: groupId },
      data: { status: "SOLD", ownerId: topBid.bidderId, finalPrice: topBid.amount },
    }),
    prisma.calcuttaConfig.update({ where: { seasonId }, data: { activeGroupId: null } }),
  ]);

  await pusher.trigger(`calcutta-${eventId}`, "group-closed", {
    groupId,
    winnerId: topBid.bidderId,
    winnerName: topBid.bidder.name,
    finalPrice: Number(topBid.amount),
    isHouse: false,
  });

  return NextResponse.json({ ok: true, winnerId: topBid.bidderId, winnerName: topBid.bidder.name, finalPrice: Number(topBid.amount) });
}
