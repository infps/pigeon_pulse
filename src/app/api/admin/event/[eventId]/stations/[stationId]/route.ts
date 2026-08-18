import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { haversine } from "@/lib/geo";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

async function requireAccess(eventId: number) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return { error: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
  }
  if (session.user.role === "ADMIN") {
    const organizer = await prisma.organizerData.findFirst({
      where: { email: session.user.email },
    });
    if (!organizer) {
      return { error: NextResponse.json({ message: "Forbidden" }, { status: 403 }) };
    }
    const event = await prisma.event.findFirst({
      where: { id: eventId, createdById: organizer.id },
      select: { id: true },
    });
    if (!event) {
      return { error: NextResponse.json({ message: "Forbidden" }, { status: 403 }) };
    }
  }
  return { session };
}

async function resolveSeasonId(request: Request, eventId: number): Promise<number | NextResponse> {
  const { searchParams } = new URL(request.url);
  const seasonIdParam = searchParams.get("seasonId");
  if (seasonIdParam) return parseInt(seasonIdParam);
  const activeSeason = await prisma.season.findFirst({
    where: { eventId, isActive: true },
    orderBy: { startDate: "desc" },
  });
  if (!activeSeason) {
    return NextResponse.json({ message: "No active season for this event" }, { status: 404 });
  }
  return activeSeason.id;
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ eventId: string; stationId: string }> },
) {
  try {
    const { eventId: eventIdParam, stationId: stationIdParam } = await params;
    const eventId = parseInt(eventIdParam);
    const stationId = parseInt(stationIdParam);
    if (isNaN(eventId) || isNaN(stationId)) {
      return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
    }

    const access = await requireAccess(eventId);
    if (access.error) return access.error;

    const seasonId = await resolveSeasonId(req, eventId);
    if (seasonId instanceof NextResponse) return seasonId;

    const body = await req.json();
    const { name, miles, km, latitude, longitude, isActive, raceTypeIds } = body || {};

    const existing = await prisma.raceStation.findFirst({
      where: { id: stationId, seasonId },
    });
    if (!existing) {
      return NextResponse.json({ message: "Station not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {
      ...(typeof name === "string" ? { name: name.trim() } : {}),
      ...(miles !== undefined ? { miles: miles != null ? Number(miles) : null } : {}),
      ...(km !== undefined ? { km: km != null ? Number(km) : null } : {}),
      ...(latitude !== undefined ? { latitude: latitude != null ? Number(latitude) : null } : {}),
      ...(longitude !== undefined ? { longitude: longitude != null ? Number(longitude) : null } : {}),
      ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
    };

    // Recompute distance when coords are provided but no explicit miles/km override.
    const lat = latitude != null ? Number(latitude) : null;
    const lng = longitude != null ? Number(longitude) : null;
    if (lat != null && lng != null && miles == null && km == null) {
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { latitude: true, longitude: true },
      });
      if (event?.latitude != null && event?.longitude != null) {
        const d = haversine(event.latitude, event.longitude, lat, lng);
        data.miles = d.miles;
        data.km = d.km;
      }
    }

    const station = await prisma.$transaction(async (tx) => {
      const updated = await tx.raceStation.update({ where: { id: stationId }, data });
      if (raceTypeIds !== undefined) {
        const typeIds: number[] = Array.isArray(raceTypeIds) ? raceTypeIds.map(Number).filter(Boolean) : [];
        await tx.raceStationRaceType.deleteMany({ where: { stationId } });
        if (typeIds.length) {
          await tx.raceStationRaceType.createMany({
            data: typeIds.map((raceTypeId) => ({ stationId, raceTypeId })),
          });
        }
      }
      return tx.raceStation.findUnique({
        where: { id: stationId },
        include: { stationRaceTypes: { include: { raceType: true } } },
      });
    });
    return NextResponse.json({ station, message: "updated" });
  } catch (error) {
    console.error("Error updating station:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ eventId: string; stationId: string }> },
) {
  try {
    const { eventId: eventIdParam, stationId: stationIdParam } = await params;
    const eventId = parseInt(eventIdParam);
    const stationId = parseInt(stationIdParam);
    if (isNaN(eventId) || isNaN(stationId)) {
      return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
    }

    const access = await requireAccess(eventId);
    if (access.error) return access.error;

    const seasonId = await resolveSeasonId(req, eventId);
    if (seasonId instanceof NextResponse) return seasonId;

    const existing = await prisma.raceStation.findFirst({
      where: { id: stationId, seasonId },
    });
    if (!existing) {
      return NextResponse.json({ message: "Station not found" }, { status: 404 });
    }

    await prisma.raceStation.delete({ where: { id: stationId } });
    return NextResponse.json({ message: "deleted" });
  } catch (error) {
    console.error("Error deleting station:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
