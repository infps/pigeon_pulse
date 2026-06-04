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

    const body = await req.json();
    const { name, miles, km, latitude, longitude, isActive, raceTypeId } = body || {};

    const existing = await prisma.raceStation.findFirst({
      where: { id: stationId, eventId },
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
      ...(raceTypeId !== undefined
        ? { raceTypeId: raceTypeId != null && raceTypeId !== "" ? Number(raceTypeId) : null }
        : {}),
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

    const station = await prisma.raceStation.update({
      where: { id: stationId },
      data,
    });
    return NextResponse.json({ station, message: "updated" });
  } catch (error) {
    console.error("Error updating station:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
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

    const existing = await prisma.raceStation.findFirst({
      where: { id: stationId, eventId },
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
