import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * Transport route history with a time range.
 *
 * The live track endpoint answers "where is the truck now". This answers "where
 * has it been", which is what the fleet tracker in the reference screenshots is
 * actually doing: a breadcrumb trail over Live / 1h / 24h / 7d / 1m or a custom
 * window.
 *
 * Public on purpose — breeders follow the truck to the liberation point, and
 * that is the whole point of broadcasting it.
 *
 *   ?range=live|1h|24h|7d|1m      relative window, default 24h
 *   ?from=ISO&to=ISO              explicit window, overrides range
 *   ?limit=500                    cap, so a long haul cannot return 50k points
 */
const RANGES: Record<string, number> = {
  live: 15 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "1m": 30 * 24 * 60 * 60 * 1000,
};

const MAX_POINTS = 2000;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ raceId: string }> }
) {
  try {
    const { raceId } = await params;
    const raceIdInt = parseInt(raceId, 10);
    if (Number.isNaN(raceIdInt)) {
      return NextResponse.json({ message: "Invalid race ID" }, { status: 400 });
    }

    const race = await prisma.race.findUnique({
      where: { id: raceIdInt },
      select: {
        id: true,
        name: true,
        raceNumber: true,
        isPrivate: true,
        transportStatus: true,
        transportStartedAt: true,
        transportEndedAt: true,
        startTime: true,
        raceStation: { select: { name: true, latitude: true, longitude: true, miles: true } },
        seasonRel: {
          select: {
            event: {
              select: { name: true, latitude: true, longitude: true, isPrivate: true },
            },
          },
        },
      },
    });

    if (!race) {
      return NextResponse.json({ message: "Race not found" }, { status: 404 });
    }
    // A private race's movements are not public either.
    if (race.isPrivate || race.seasonRel?.event?.isPrivate) {
      return NextResponse.json({ message: "Race not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") ?? "500", 10) || 500, 1),
      MAX_POINTS
    );

    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const rangeKey = (searchParams.get("range") ?? "24h").toLowerCase();

    let from: Date;
    let to: Date = new Date();

    if (fromParam) {
      const parsedFrom = new Date(fromParam);
      const parsedTo = toParam ? new Date(toParam) : new Date();
      if (Number.isNaN(parsedFrom.getTime()) || Number.isNaN(parsedTo.getTime())) {
        return NextResponse.json({ message: "from and to must be valid dates" }, { status: 400 });
      }
      from = parsedFrom;
      to = parsedTo;
    } else {
      const window = RANGES[rangeKey] ?? RANGES["24h"];
      from = new Date(Date.now() - window);
    }

    const total = await prisma.truckPing.count({
      where: { raceId: raceIdInt, recordedAt: { gte: from, lte: to } },
    });

    const pings = await prisma.truckPing.findMany({
      where: { raceId: raceIdInt, recordedAt: { gte: from, lte: to } },
      orderBy: { recordedAt: "asc" },
      take: limit,
      select: {
        latitude: true,
        longitude: true,
        speed: true,
        heading: true,
        accuracy: true,
        recordedAt: true,
      },
    });

    const latest = pings.length > 0 ? pings[pings.length - 1] : null;

    return NextResponse.json({
      race: {
        id: race.id,
        name: race.name || (race.raceNumber != null ? `Race ${race.raceNumber}` : "Race"),
        eventName: race.seasonRel?.event?.name ?? null,
        transportStatus: race.transportStatus,
        transportStartedAt: race.transportStartedAt,
        transportEndedAt: race.transportEndedAt,
        releaseTime: race.startTime,
      },
      origin: {
        latitude: race.seasonRel?.event?.latitude ?? null,
        longitude: race.seasonRel?.event?.longitude ?? null,
      },
      destination: race.raceStation
        ? {
            name: race.raceStation.name,
            latitude: race.raceStation.latitude,
            longitude: race.raceStation.longitude,
            miles: race.raceStation.miles,
          }
        : null,
      window: { from, to, range: fromParam ? "custom" : rangeKey },
      // Reported rather than silently trimmed, so a capped trail cannot be
      // mistaken for a short one.
      points: pings,
      returned: pings.length,
      total,
      truncated: total > pings.length,
      latest,
    });
  } catch (error) {
    console.error("Failed to load track history:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
