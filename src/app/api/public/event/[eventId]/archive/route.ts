import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * Archived races — WinCompanion's "List Archived Races", grouped by season.
 *
 * Their page groups by year (YB23, YB24, YB25) and shows liberation time,
 * station, distance and a results link per race. Seasons are our equivalent of
 * their year labels, so the grouping follows the season the race belongs to.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const eventIdInt = parseInt(eventId, 10);
    if (Number.isNaN(eventIdInt)) {
      return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
    }

    const races = await prisma.race.findMany({
      where: {
        seasonRel: { eventId: eventIdInt },
        // Only races that have actually been flown belong in an archive.
        status: { not: "REGISTERING" },
        isPrivate: false,
      },
      orderBy: [{ startTime: "desc" }],
      select: {
        id: true,
        name: true,
        raceNumber: true,
        startTime: true,
        distance: true,
        status: true,
        raceType: { select: { name: true, prizeRole: true } },
        raceStation: { select: { name: true, miles: true, km: true } },
        seasonRel: { select: { id: true, name: true, startDate: true } },
        _count: { select: { raceItems: true } },
      },
    });

    // Group by season, newest season first, races in flown order within it.
    const bySeason = new Map<
      number,
      {
        seasonId: number;
        seasonName: string;
        startDate: Date | null;
        races: Array<Record<string, unknown>>;
      }
    >();

    for (const race of races) {
      const season = race.seasonRel;
      if (!season) continue;

      const bucket = bySeason.get(season.id) ?? {
        seasonId: season.id,
        seasonName: season.name,
        startDate: season.startDate,
        races: [],
      };

      bucket.races.push({
        id: race.id,
        name: race.name || (race.raceNumber != null ? `Race ${race.raceNumber}` : "Race"),
        raceNumber: race.raceNumber,
        liberation: race.startTime,
        station: race.raceStation?.name ?? null,
        miles: race.raceStation?.miles ?? race.distance ?? null,
        km: race.raceStation?.km ?? null,
        raceType: race.raceType?.name ?? null,
        prizeRole: race.raceType?.prizeRole ?? "NONE",
        status: race.status,
        birdCount: race._count.raceItems,
      });

      bySeason.set(season.id, bucket);
    }

    const seasons = [...bySeason.values()].sort(
      (a, b) => (b.startDate?.getTime() ?? 0) - (a.startDate?.getTime() ?? 0)
    );

    // Races within a season read oldest-first, the order they were flown.
    for (const season of seasons) {
      season.races.sort(
        (a, b) =>
          new Date((a.liberation as string) ?? 0).getTime() -
          new Date((b.liberation as string) ?? 0).getTime()
      );
    }

    return NextResponse.json({
      seasons,
      totalRaces: races.length,
    });
  } catch (error) {
    console.error("Failed to load race archive:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
