import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const liveRaces = await prisma.race.findMany({
      where: {
        isLive: true,
        isClosed: false,
      },
      include: {
        event: {
          select: {
            eventId: true,
            name: true,
            shortName: true,
            logoImage: true,
            bannerImage: true,
            isOpen: true,
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
      },
      orderBy: {
        releaseDate: "desc",
      },
    });

    return NextResponse.json({
      races: liveRaces,
      count: liveRaces.length,
    });
  } catch (error) {
    console.error("Error fetching live races:", error);
    return NextResponse.json(
      { error: "Failed to fetch live races" },
      { status: 500 }
    );
  }
}
