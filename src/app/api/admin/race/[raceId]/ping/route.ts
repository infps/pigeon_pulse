import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

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
      where: { id: raceId, event: { createdById: organizer.id } },
      select: { id: true },
    });
    if (!race) {
      return { error: NextResponse.json({ message: "Forbidden" }, { status: 403 }) };
    }
  }
  return { session };
}

interface PingInput {
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  recordedAt: string;
}

export async function POST(req: Request, { params }: { params: Promise<{ raceId: string }> }) {
  try {
    const { raceId: raceIdParam } = await params;
    const raceId = parseInt(raceIdParam);
    if (isNaN(raceId)) {
      return NextResponse.json({ message: "Invalid race ID" }, { status: 400 });
    }

    const access = await requireRaceAccess(raceId);
    if (access.error) return access.error;

    const body = await req.json();
    const raw = body?.pings ?? body;
    const pings: PingInput[] = Array.isArray(raw) ? raw : raw ? [raw] : [];

    if (pings.length === 0) {
      return NextResponse.json({ message: "no pings" }, { status: 400 });
    }
    for (const p of pings) {
      if (p == null || p.lat == null || p.lng == null) {
        return NextResponse.json({ message: "missing coords" }, { status: 400 });
      }
    }

    const race = await prisma.race.findUnique({
      where: { id: raceId },
      select: { transportStatus: true },
    });
    if (race?.transportStatus !== "IN_TRANSIT") {
      return NextResponse.json({ message: "not in transit" }, { status: 409 });
    }

    const result = await prisma.truckPing.createMany({
      data: pings.map((p) => ({
        raceId,
        latitude: Number(p.lat),
        longitude: Number(p.lng),
        speed: p.speed != null ? Number(p.speed) : null,
        heading: p.heading != null ? Number(p.heading) : null,
        accuracy: p.accuracy != null ? Number(p.accuracy) : null,
        recordedAt: new Date(p.recordedAt),
      })),
    });

    return NextResponse.json({ count: result.count });
  } catch (error) {
    console.error("Error recording pings:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
