import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

const MAX_PINGS = 2000;

async function requireRaceAccess(raceId: number) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return { error: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
  }
  if (session.user.role === "ADMIN") {
    const organizer = await prisma.organizerData.findFirst({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!organizer) {
      return { error: NextResponse.json({ message: "Forbidden" }, { status: 403 }) };
    }
    const race = await prisma.race.findFirst({
      where: { id: raceId, seasonRel: { event: { createdById: organizer.id } } },
      select: { id: true },
    });
    if (!race) {
      return { error: NextResponse.json({ message: "Forbidden" }, { status: 403 }) };
    }
  }
  return { session };
}

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

    const access = await requireRaceAccess(raceId);
    if (access.error) return access.error;

    const race = await prisma.race.findUnique({
      where: { id: raceId },
      select: {
        transportStatus: true,
        transportStartedAt: true,
        seasonRel: { include: { event: { select: { latitude: true, longitude: true, name: true } } } },
        raceStation: { select: { name: true, latitude: true, longitude: true, miles: true } },
      },
    });

    if (!race) {
      return NextResponse.json({ message: "Race not found" }, { status: 404 });
    }

    const rows = await prisma.truckPing.findMany({
      where: { raceId },
      orderBy: { recordedAt: "asc" },
      take: MAX_PINGS,
      select: { latitude: true, longitude: true, speed: true, heading: true, recordedAt: true },
    });

    const pings = rows.map(mapPing);
    const latest = rows.length > 0 ? mapPing(rows[rows.length - 1]) : null;

    const station = race.raceStation
      ? {
          name: race.raceStation.name,
          lat: race.raceStation.latitude,
          lng: race.raceStation.longitude,
          miles: race.raceStation.miles,
        }
      : null;

    const loft =
      race.seasonRel?.event?.latitude != null
        ? { lat: race.seasonRel.event.latitude, lng: race.seasonRel.event.longitude, name: race.seasonRel.event.name }
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
    console.error("Error loading admin track:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
