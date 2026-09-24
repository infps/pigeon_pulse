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

    const itemSelect = {
      id: true,
      status: true,
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
    } as const;

    const items = await prisma.raceItem.findMany({
      where: { raceId },
      select: itemSelect,
    });

    const startMs = race.startTime ? new Date(race.startTime).getTime() : null;
    const distanceYards = (race.distance ?? 0) * 1760;

    const arrivedItems = items
      .filter((i) => i.result?.birdPosition != null)
      .sort((a, b) => (a.result!.birdPosition as number) - (b.result!.birdPosition as number));

    const leaderMs = arrivedItems[0]?.result?.arrivalTime
      ? new Date(arrivedItems[0].result.arrivalTime).getTime()
      : null;

    const toEntry = (item: typeof items[number], rank: number | null) => {
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
        rank,
        status: item.status,
        band: item.inventoryItem?.bird?.band ?? "",
        birdName: item.inventoryItem?.bird?.birdName ?? null,
        loftName,
        loftImage: breeder?.user?.image ?? null,
        countryCode: breeder?.country ?? null,
        arrivalTime: item.result?.arrivalTime ?? null,
        ypm,
        gapMs: arrivalMs && leaderMs ? arrivalMs - leaderMs : null,
      };
    };

    const arrivals = arrivedItems.map((item) => toEntry(item, item.result!.birdPosition as number));

    // Non-finishers appended after ranked arrivals — shown dimmed in the overlay.
    const nonFinished = items
      .filter((i) => i.result?.birdPosition == null)
      .filter((i) => ["FOREIGN_BIRD", "STRAY", "LOST"].includes(i.status))
      .map((item) => toEntry(item, null));

    const allEntries = [...arrivals, ...nonFinished];

    // latestId = the most recently arrived bird by arrivalTime, not by rank.
    // Using rank-order last would flash the slowest finisher every poll cycle.
    let latestId: number | null = null;
    let latestMs = -Infinity;
    for (const a of arrivals) {
      if (a.arrivalTime) {
        const t = new Date(a.arrivalTime).getTime();
        if (t > latestMs) { latestMs = t; latestId = a.id; }
      }
    }

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
      arrivals: allEntries,
      latestId,
      count: arrivals.length, // only ranked finishers count
    });
  } catch (error) {
    console.error("Failed to build race overlay data:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
