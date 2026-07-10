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
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { groupId, amount } = await request.json();
  if (!groupId || amount == null) return NextResponse.json({ message: "groupId and amount required" }, { status: 400 });

  const config = await prisma.calcuttaConfig.findUnique({ where: { eventId } });
  if (!config || config.activeGroupId !== groupId) {
    return NextResponse.json({ message: "Group is not currently active" }, { status: 409 });
  }

  const group = await prisma.calcuttaBetGroup.findFirst({
    where: { id: groupId, eventId },
    include: {
      bids: { orderBy: { amount: "desc" }, take: 1 },
    },
  });
  if (!group || group.status !== "BIDDING") {
    return NextResponse.json({ message: "Group not open for bidding" }, { status: 409 });
  }

  const currentMax = group.bids[0] ? Number(group.bids[0].amount) : Number(group.startingBid);
  if (Number(amount) <= currentMax) {
    return NextResponse.json({ message: `Bid must be greater than ${currentMax}` }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.calcuttaBid.create({
      data: { groupId, bidderId: session.user.id, amount: Number(amount) },
    }),
    prisma.calcuttaBetGroup.update({ where: { id: groupId }, data: { lastBidAt: new Date() } }),
  ]);

  await pusher.trigger(`calcutta-${eventId}`, "bid-placed", {
    groupId,
    amount: Number(amount),
    bidderName: session.user.name,
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
