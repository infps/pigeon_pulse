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
  if (!config) return NextResponse.json({ message: "Config not found. Set up Calcutta config first." }, { status: 404 });

  const inventories = await prisma.eventInventory.findMany({
    where: { seasonId },
    select: {
      id: true,
      breeder: { select: { firstName: true, lastName: true } },
      _count: { select: { items: true } },
    },
  });

  // Filter lofts with at least 1 bird
  const lofts = inventories.filter((inv) => inv._count.items > 0);
  if (lofts.length === 0) return NextResponse.json({ message: "No registered lofts with birds" }, { status: 400 });

  // Fisher-Yates shuffle
  for (let i = lofts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lofts[i], lofts[j]] = [lofts[j], lofts[i]];
  }

  const target = config.targetGroupSize;

  // Greedy pack into groups
  type GroupDraft = { inventoryIds: number[]; birdCount: number };
  const groups: GroupDraft[] = [];
  let current: GroupDraft = { inventoryIds: [], birdCount: 0 };

  for (const loft of lofts) {
    const birds = loft._count.items;
    if (current.birdCount > 0 && current.birdCount + birds > target) {
      groups.push(current);
      current = { inventoryIds: [], birdCount: 0 };
    }
    current.inventoryIds.push(loft.id);
    current.birdCount += birds;
  }
  if (current.inventoryIds.length > 0) groups.push(current);

  // Merge last group into previous if it's less than half target size
  if (groups.length >= 2) {
    const last = groups[groups.length - 1];
    if (last.birdCount < target / 2) {
      const prev = groups[groups.length - 2];
      prev.inventoryIds.push(...last.inventoryIds);
      prev.birdCount += last.birdCount;
      groups.pop();
    }
  }

  const pricePerBird = Number(config.pricePerBird);

  const created = await prisma.$transaction(async (tx) => {
    // Delete only PENDING groups (preserve EARLY_BOUGHT/SOLD/HOUSE)
    await tx.calcuttaBetGroup.deleteMany({
      where: { seasonId, status: "PENDING" },
    });

    const newGroups = await Promise.all(
      groups.map((g, i) =>
        tx.calcuttaBetGroup.create({
          data: {
            seasonId,
            groupNumber: i + 1,
            birdCount: g.birdCount,
            calculatedPrice: pricePerBird * g.birdCount,
            startingBid: pricePerBird * g.birdCount,
            members: {
              create: g.inventoryIds.map((id) => ({ eventInventoryId: id })),
            },
          },
          include: { _count: { select: { members: true } } },
        })
      )
    );

    return newGroups;
  });

  return NextResponse.json({
    groups: created.map((g) => ({
      id: g.id,
      groupNumber: g.groupNumber,
      birdCount: g.birdCount,
      calculatedPrice: Number(g.calculatedPrice),
      startingBid: Number(g.startingBid),
      status: g.status,
      memberCount: g._count.members,
    })),
  });
}
