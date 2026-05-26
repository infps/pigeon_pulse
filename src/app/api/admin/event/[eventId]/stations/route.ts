import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
    const { name, miles, km, latitude, longitude } = body || {};
    if (!name || typeof name !== "string") {
      return NextResponse.json({ message: "name required" }, { status: 400 });
    }

    const station = await prisma.raceStation.create({
      data: {
        eventId,
        name: name.trim(),
        miles: miles != null ? Number(miles) : null,
        km: km != null ? Number(km) : null,
        latitude: latitude != null ? Number(latitude) : null,
        longitude: longitude != null ? Number(longitude) : null,
      },
    });
    return NextResponse.json({ station, message: "created" }, { status: 201 });
  } catch (error) {
    console.error("Error creating station:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
