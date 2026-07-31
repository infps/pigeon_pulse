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

  const { groupId } = await request.json();
  if (!groupId) return NextResponse.json({ message: "groupId required" }, { status: 400 });

  const group = await prisma.calcuttaBetGroup.findFirst({
    where: { id: groupId, seasonId },
    include: {
      members: {
        include: {
          eventInventory: {
            select: {
              id: true,
              breeder: { select: { firstName: true, lastName: true } },
              items: { select: { bird: { select: { band: true, birdName: true } } } },
            },
          },
        },
      },
    },
  });
  if (!group) return NextResponse.json({ message: "Group not found" }, { status: 404 });
  if (!["PENDING"].includes(group.status)) return NextResponse.json({ message: "Group not in PENDING status" }, { status: 409 });

  const config = await prisma.calcuttaConfig.findUnique({ where: { seasonId } });
  if (!config) return NextResponse.json({ message: "Config not found" }, { status: 404 });

  await prisma.$transaction([
    prisma.calcuttaBetGroup.update({ where: { id: groupId }, data: { status: "BIDDING" } }),
    prisma.calcuttaConfig.update({ where: { seasonId }, data: { activeGroupId: groupId, phase: "AUCTION" } }),
  ]);

  const birds = group.members.flatMap((m) =>
    m.eventInventory.items.map((item) => ({ band: item.bird?.band, name: item.bird?.birdName }))
  );

  await pusher.trigger(`calcutta-${eventId}`, "group-changed", {
    groupId,
    groupNumber: group.groupNumber,
    birds,
    calculatedPrice: Number(group.calculatedPrice),
    startingBid: Number(group.startingBid),
    duration: config.biddingDuration,
    antiSnipeDuration: config.antiSnipeDuration,
  });

  return NextResponse.json({ ok: true });
}
