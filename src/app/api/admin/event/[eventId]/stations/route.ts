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

export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId: eventIdParam } = await params;
    const eventId = parseInt(eventIdParam);
    if (isNaN(eventId)) {
      return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
    }

    const access = await requireAccess(eventId);
    if (access.error) return access.error;

    const stations = await prisma.raceStation.findMany({
      where: { eventId },
      orderBy: { miles: "asc" },
      include: { raceType: true },
    });
    return NextResponse.json({ stations, message: "ok" });
  } catch (error) {
    console.error("Error listing stations:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId: eventIdParam } = await params;
    const eventId = parseInt(eventIdParam);
    if (isNaN(eventId)) {
      return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
    }

    const access = await requireAccess(eventId);
    if (access.error) return access.error;

    const body = await req.json();
    const { name, miles, km, latitude, longitude, isActive, raceTypeId } = body || {};
    if (!name || typeof name !== "string") {
      return NextResponse.json({ message: "name required" }, { status: 400 });
    }

    const lat = latitude != null ? Number(latitude) : null;
    const lng = longitude != null ? Number(longitude) : null;

    // Auto-compute distance from event point when station coords present and no
    // explicit override supplied by the client.
    let milesVal = miles != null ? Number(miles) : null;
    let kmVal = km != null ? Number(km) : null;
    if (lat != null && lng != null && milesVal == null && kmVal == null) {
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { latitude: true, longitude: true },
      });
      if (event?.latitude != null && event?.longitude != null) {
        const d = haversine(event.latitude, event.longitude, lat, lng);
        milesVal = d.miles;
        kmVal = d.km;
      }
    }

    const station = await prisma.raceStation.create({
      data: {
        eventId,
        name: name.trim(),
        miles: milesVal,
        km: kmVal,
        latitude: lat,
        longitude: lng,
        isActive: isActive != null ? Boolean(isActive) : true,
        raceTypeId: raceTypeId != null && raceTypeId !== "" ? Number(raceTypeId) : null,
      },
    });
    return NextResponse.json({ station, message: "created" }, { status: 201 });
  } catch (error) {
    console.error("Error creating station:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
