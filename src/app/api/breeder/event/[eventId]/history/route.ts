import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId: eventIdParam } = await params;
    const eventId = parseInt(eventIdParam);
    if (isNaN(eventId)) {
      return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
    }

    const activeSeason = await prisma.season.findFirst({
      where: { eventId, isActive: true },
      orderBy: { startDate: "desc" },
    });
    if (!activeSeason) {
      return NextResponse.json({ message: "No active season for this event" }, { status: 404 });
    }

    const races = await prisma.race.findMany({
      where: { seasonId: activeSeason.id },
      include: {
        raceType: { select: { id: true, name: true } },
      },
      orderBy: [{ startTime: "asc" }],
    });

    return NextResponse.json({ races, message: "ok" });
  } catch (error) {
    console.error("Error fetching event history:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
