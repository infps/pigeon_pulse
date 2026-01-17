import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");
    const raceId = searchParams.get("raceId");

    // If raceId is provided, return single race
    if (raceId) {
      const race = await prisma.race.findUnique({
        where: { raceId },
        include: {
          raceType: true,
          event: true,
        },
      });

      if (!race) {
        return NextResponse.json(
          { message: "Race not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { race, message: "Race fetched successfully" },
        { status: 200 }
      );
    }

    const whereClause = eventId ? { eventId } : {};

    const races = await prisma.race.findMany({
      where: whereClause,
      include: {
        raceType: true,
        event: {
          select: {
            eventId: true,
            name: true,
            shortName: true,
          },
        },
      },
      orderBy: {
        releaseDate: "desc",
      },
    });

    return NextResponse.json(
      { races, message: "Races fetched successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching races:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
