import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const MAX_PINGS = 200;

function mapPing(p: {
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  recordedAt: Date;
}) {
  return {
    lat: p.latitude,
    lng: p.longitude,
    speed: p.speed,
    heading: p.heading,
    recordedAt: p.recordedAt,
  };
}

export async function GET(_req: Request, { params }: { params: Promise<{ raceId: string }> }) {
  try {
    const { raceId: raceIdParam } = await params;
    const raceId = parseInt(raceIdParam);
    if (isNaN(raceId)) {
      return NextResponse.json({ message: "Invalid race ID" }, { status: 400 });
    }

    const race = await prisma.race.findUnique({
      where: { id: raceId },
      select: {
        transportStatus: true,
        transportStartedAt: true,
        event: { select: { latitude: true, longitude: true, name: true } },
        raceStation: { select: { name: true, latitude: true, longitude: true, miles: true } },
      },
    });

    if (!race) {
      return NextResponse.json({ message: "Race not found" }, { status: 404 });
    }

    let latest: ReturnType<typeof mapPing> | null = null;
    let pings: ReturnType<typeof mapPing>[] = [];

    if (race.transportStatus === "IN_TRANSIT") {
      const rows = await prisma.truckPing.findMany({
        where: { raceId },
        orderBy: { recordedAt: "asc" },
        select: { latitude: true, longitude: true, speed: true, heading: true, recordedAt: true },
      });

      let sampled = rows;
      if (rows.length > MAX_PINGS) {
        const stride = Math.ceil(rows.length / MAX_PINGS);
        sampled = rows.filter((_, i) => i % stride === 0);
        // always keep the last point
        if (sampled[sampled.length - 1] !== rows[rows.length - 1]) {
          sampled.push(rows[rows.length - 1]);
        }
      }

      pings = sampled.map(mapPing);
      latest = rows.length > 0 ? mapPing(rows[rows.length - 1]) : null;
    }

    const station = race.raceStation
      ? {
          name: race.raceStation.name,
          lat: race.raceStation.latitude,
          lng: race.raceStation.longitude,
          miles: race.raceStation.miles,
        }
      : null;

    const loft =
      race.event?.latitude != null
        ? { lat: race.event.latitude, lng: race.event.longitude, name: race.event.name }
        : null;

    return NextResponse.json({
      transportStatus: race.transportStatus,
      transportStartedAt: race.transportStartedAt,
      latest,
      pings,
      station,
      loft,
    });
  } catch (error) {
    console.error("Error loading public track:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
