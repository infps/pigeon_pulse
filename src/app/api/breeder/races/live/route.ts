import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    // Live = startTime is set and not closed
    const liveRaces = await prisma.race.findMany({
      where: {
        startTime: { not: null },
        NOT: { isClosed: 1 },
      },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            shortName: true,
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
        startTime: "desc",
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
