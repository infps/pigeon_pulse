import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
            raceItems: true,
          },
        },
        raceItems: {
          where: { status: "ARRIVED" },
          select: { id: true },
        },
      },
      orderBy: {
        id: "desc",
      },
    });

    const races = liveRaces.map(({ raceItems, seasonRel, ...r }) => ({
      ...r,
      seasonRel,
      event: seasonRel?.event ?? null,
      arrivedCount: raceItems.length,
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
