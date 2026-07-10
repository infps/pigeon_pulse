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
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const config = await prisma.calcuttaConfig.findUnique({ where: { eventId } });

  const [groups, activeGroup] = await Promise.all([
    prisma.calcuttaBetGroup.findMany({
      where: { eventId },
      orderBy: { groupNumber: "asc" },
      select: {
        id: true, groupNumber: true, birdCount: true, status: true, isHouse: true,
        calculatedPrice: true, startingBid: true, finalPrice: true,
        owner: { select: { id: true, name: true } },
        bids: { orderBy: { amount: "desc" }, take: 1, select: { amount: true } },
      },
    }),
    config?.activeGroupId
      ? prisma.calcuttaBetGroup.findUnique({
          where: { id: config.activeGroupId },
          include: {
            members: {
              include: {
                eventInventory: {
                  select: {
                    items: {
                      select: { bird: { select: { band: true, birdName: true } } },
                    },
                  },
                },
              },
            },
            bids: {
              orderBy: { amount: "desc" },
              take: 10,
              include: { bidder: { select: { name: true } } },
            },
          },
        })
      : null,
  ]);

  return NextResponse.json({
    config: config
      ? {
          ...config,
          pricePerBird: Number(config.pricePerBird),
        }
      : null,
    activeGroup: activeGroup
      ? {
          id: activeGroup.id,
          groupNumber: activeGroup.groupNumber,
          birdCount: activeGroup.birdCount,
          calculatedPrice: Number(activeGroup.calculatedPrice),
          startingBid: Number(activeGroup.startingBid),
          lastBidAt: activeGroup.lastBidAt,
          birds: activeGroup.members.flatMap((m) =>
            m.eventInventory.items.map((i) => ({ band: i.bird?.band, name: i.bird?.birdName }))
          ),
          currentBid: activeGroup.bids[0] ? Number(activeGroup.bids[0].amount) : null,
          bidderName: activeGroup.bids[0] ? activeGroup.bids[0].bidder.name : null,
          recentBids: activeGroup.bids.map((b) => ({
            amount: Number(b.amount),
            bidderName: b.bidder.name,
            createdAt: b.createdAt,
          })),
        }
      : null,
    groups: groups.map((g) => ({
      id: g.id,
      groupNumber: g.groupNumber,
      birdCount: g.birdCount,
      status: g.status,
      isHouse: g.isHouse,
      calculatedPrice: Number(g.calculatedPrice),
      startingBid: Number(g.startingBid),
      finalPrice: g.finalPrice ? Number(g.finalPrice) : null,
      owner: g.owner,
      currentBid: g.bids[0] ? Number(g.bids[0].amount) : null,
    })),
  });
}
