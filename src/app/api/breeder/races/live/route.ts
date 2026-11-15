import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { activeRaceItemOr } from "@/lib/entry-filters";
export async function GET(req: NextRequest) {
  try {
    const liveRaces = await prisma.race.findMany({
      where: {
        startTime: { not: null },
        OR: [{ isClosed: null }, { isClosed: { not: 1 } }],
        AND: [
          {
            OR: [
              { isLive: true },
              { status: "STARTED" },
              { status: "REGISTERING" },
            ],
          },
        ],
      },
      include: {
        seasonRel: {
          include: {
            event: {
              select: {
                id: true,
                name: true,
                shortName: true,
                logoImage: true,
                isOpen: true,
              },
            },
          },
        },
        raceType: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            raceItems: { where: { OR: activeRaceItemOr } },
          },
        },
      },
      orderBy: {
        id: "desc",
      },
    });

    const raceIds = liveRaces.map((r) => r.id);
    // Count arrivals in the DB instead of loading every arrived id.
    const [hidden, arrived] = await Promise.all([
      prisma.raceStatusVisibility.findMany({
        where: { status: "ARRIVED", visible: false, raceId: { in: raceIds } },
        select: { raceId: true },
      }),
      prisma.raceItem.groupBy({
        by: ["raceId"],
        where: { raceId: { in: raceIds }, status: "ARRIVED", OR: activeRaceItemOr },
        _count: { _all: true },
      }),
    ]);
    const hiddenArrived = new Set(hidden.map((v) => v.raceId));
    const arrivedByRace = new Map(arrived.map((a) => [a.raceId, a._count._all]));

    const races = liveRaces.map(({ seasonRel, ...r }) => ({
      ...r,
      seasonRel,
      event: seasonRel?.event ?? null,
      arrivedCount: hiddenArrived.has(r.id) ? 0 : arrivedByRace.get(r.id) ?? 0,
    }));

    return NextResponse.json({
      races,
      count: races.length,
    });
  } catch (error) {
    console.error("Error fetching live races:", error);
    return NextResponse.json(
      { error: "Failed to fetch live races" },
      { status: 500 }
    );
  }
}
