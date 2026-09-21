import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Everything the broadcast overlay draws, in one request.
 *
 * Public, because it is read by OBS on a machine that has never signed in and
 * never will. Nothing here is not already on the public results page.
 *
 * The speed and gap arithmetic happens here rather than in the overlay. The
 * overlay polls every few seconds on a machine that is also encoding video, and
 * the same numbers are already worked out this way on the results page —
 * computing them twice in two languages is how two screens end up disagreeing
 * on live television.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ raceId: string }> }
) {
  try {
    const { raceId: raceIdParam } = await params;
    const raceId = parseInt(raceIdParam, 10);
    if (Number.isNaN(raceId)) {
      return NextResponse.json({ message: "Invalid race ID" }, { status: 400 });
    }

    const race = await prisma.race.findUnique({
      where: { id: raceId },
      select: {
        id: true,
        name: true,
        raceNumber: true,
        status: true,
        startTime: true,
        distance: true,
        isClosed: true,
        seasonRel: {
          select: { event: { select: { name: true, logoImage: true } } },
        },
      },
    });

    if (!race) {
      return NextResponse.json({ message: "Race not found" }, { status: 404 });
    }

    const items = await prisma.raceItem.findMany({
      where: { raceId, result: { arrivalTime: { not: null } } },
      select: {
        id: true,
        result: { select: { birdPosition: true, arrivalTime: true } },
        inventoryItem: {
          select: {
            bird: {
              select: {
                band: true,
                birdName: true,
                breeder: {
                  select: {
                    firstName: true,
                    lastName: true,
                    country: true,
                    user: { select: { loftName: true, image: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    const arrived = items
      .filter((i) => i.result?.birdPosition != null)
      .sort(
        (a, b) => (a.result!.birdPosition as number) - (b.result!.birdPosition as number)
      );

    const startMs = race.startTime ? new Date(race.startTime).getTime() : null;
    const leaderMs = arrived[0]?.result?.arrivalTime
      ? new Date(arrived[0].result.arrivalTime).getTime()
      : null;
    const distanceYards = (race.distance ?? 0) * 1760;

    const arrivals = arrived.map((item) => {
      const arrivalMs = item.result?.arrivalTime
        ? new Date(item.result.arrivalTime).getTime()
        : null;

      let ypm: number | null = null;
      if (arrivalMs && startMs && distanceYards > 0) {
        const minutes = (arrivalMs - startMs) / 60000;
        if (minutes > 0) ypm = Math.round(distanceYards / minutes);
      }

      const breeder = item.inventoryItem?.bird?.breeder;
      const loftName =
        breeder?.user?.loftName ||
        `${breeder?.firstName ?? ""} ${breeder?.lastName ?? ""}`.trim() ||
        "—";

      return {
        id: item.id,
        rank: item.result?.birdPosition ?? null,
        band: item.inventoryItem?.bird?.band ?? "",
        birdName: item.inventoryItem?.bird?.birdName ?? null,
        loftName,
        loftImage: breeder?.user?.image ?? null,
        countryCode: breeder?.country ?? null,
        arrivalTime: item.result?.arrivalTime ?? null,
        ypm,
        // Behind the leader, which is the number a commentator says out loud.
        gapMs: arrivalMs && leaderMs ? arrivalMs - leaderMs : null,
      };
    });

    return NextResponse.json({
      race: {
        id: race.id,
        name: race.name ?? `Race ${race.raceNumber ?? race.id}`,
        status: race.status,
        startTime: race.startTime,
        distance: race.distance,
        isClosed: race.isClosed === 1,
        eventName: race.seasonRel?.event?.name ?? null,
        eventLogo: race.seasonRel?.event?.logoImage ?? null,
      },
      arrivals,
      // The overlay uses this to notice a new bird without diffing the list.
      latestId: arrivals.length > 0 ? arrivals[arrivals.length - 1].id : null,
      count: arrivals.length,
    });
  } catch (error) {
    console.error("Failed to build race overlay data:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
