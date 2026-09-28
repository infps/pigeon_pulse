import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { raceVisibilityFilter } from "@/lib/visibility";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");
    const raceId = searchParams.get("raceId");

    const session = await auth.api.getSession({ headers: await headers() });

    // A private race, or any race under a private event, is hidden unless this
    // breeder has a bird in it.
    const visibility = await raceVisibilityFilter(
      session?.user?.id,
      session?.user?.role
    );

    // If raceId is provided, return single race
    if (raceId) {
      const race = await prisma.race.findFirst({
        where: { AND: [{ id: parseInt(raceId) }, visibility] },
        include: {
          raceType: true,
          seasonRel: { include: { event: true } },
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

    // ponytail: resolve eventId→seasonIds then filter; races no longer have eventId
    const whereClause = eventId
      ? { AND: [{ seasonRel: { eventId: parseInt(eventId) } }, visibility] }
      : visibility;

    const races = await prisma.race.findMany({
      where: whereClause,
      include: {
        raceType: true,
        seasonRel: {
          include: {
            event: {
              select: {
                id: true,
                name: true,
                shortName: true,
              },
            },
          },
        },
      },
      orderBy: {
        startTime: "desc",
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
