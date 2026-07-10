import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: eventIdParam } = await params;
  const eventId = parseInt(eventIdParam);
  if (isNaN(eventId)) return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const groups = await prisma.calcuttaBetGroup.findMany({
    where: { eventId },
    orderBy: { groupNumber: "asc" },
    include: {
      owner: { select: { id: true, name: true } },
      members: {
        include: {
          eventInventory: {
            select: {
              id: true,
              breeder: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
      bids: {
        orderBy: { amount: "desc" },
        take: 1,
        select: { amount: true, bidder: { select: { name: true } } },
      },
    },
  });

  return NextResponse.json({
    groups: groups.map((g) => ({
      id: g.id,
      groupNumber: g.groupNumber,
      birdCount: g.birdCount,
      calculatedPrice: Number(g.calculatedPrice),
      startingBid: Number(g.startingBid),
      status: g.status,
      isHouse: g.isHouse,
      finalPrice: g.finalPrice ? Number(g.finalPrice) : null,
      owner: g.owner,
      lastBidAt: g.lastBidAt,
      currentBid: g.bids[0] ? { amount: Number(g.bids[0].amount), bidderName: g.bids[0].bidder.name } : null,
      members: g.members.map((m) => ({
        eventInventoryId: m.eventInventoryId,
        breeder: m.eventInventory.breeder,
      })),
    })),
  });
}
