import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * Public race stations — the liberation points, presented the way AGN lists
 * them: name, miles, kilometres, coordinates and a map link, shortest first.
 *
 * Their page carries the caveat that the coordinates are informational and the
 * handler confirms the actual release point. That is a real operational caution,
 * not decoration, so it is returned with the data rather than left to the page.
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

    const seasonParam = new URL(request.url).searchParams.get("seasonId");
    const seasonId = seasonParam ? parseInt(seasonParam, 10) : null;

    const season =
      seasonId != null && !Number.isNaN(seasonId)
        ? await prisma.season.findFirst({
            where: { id: seasonId, eventId: eventIdInt },
            select: { id: true, name: true },
          })
        : await prisma.season.findFirst({
            where: { eventId: eventIdInt, isActive: true },
            orderBy: { startDate: "desc" },
            select: { id: true, name: true },
          });

    if (!season) {
      return NextResponse.json({ message: "No season found for this event" }, { status: 404 });
    }

    const stations = await prisma.raceStation.findMany({
      where: { seasonId: season.id },
      orderBy: [{ miles: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        miles: true,
        km: true,
        latitude: true,
        longitude: true,
        isActive: true,
        stationRaceTypes: { select: { raceType: { select: { name: true } } } },
        races: {
          where: { isPrivate: false },
          select: { id: true, name: true, raceNumber: true, startTime: true, status: true },
          orderBy: { startTime: "desc" },
          take: 3,
        },
      },
    });

    return NextResponse.json({
      season,
      stations: stations.map((s) => ({
        id: s.id,
        name: s.name,
        miles: s.miles,
        km: s.km,
        latitude: s.latitude,
        longitude: s.longitude,
        isActive: s.isActive,
        raceTypes: s.stationRaceTypes.map((rt) => rt.raceType?.name).filter(Boolean),
        mapUrl:
          s.latitude != null && s.longitude != null
            ? `https://www.google.com/maps/search/?api=1&query=${s.latitude},${s.longitude}`
            : null,
        recentRaces: s.races.map((r) => ({
          id: r.id,
          name: r.name || (r.raceNumber != null ? `Race ${r.raceNumber}` : "Race"),
          startTime: r.startTime,
          status: r.status,
        })),
      })),
      note: "GPS coordinates are for information only. Confirm the actual release point with the handler.",
    });
  } catch (error) {
    console.error("Failed to load public stations:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
