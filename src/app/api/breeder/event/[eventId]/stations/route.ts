import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId: eventIdParam } = await params;
    const eventId = parseInt(eventIdParam);
    if (isNaN(eventId)) {
      return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const seasonIdParam = searchParams.get("seasonId");
    let seasonId: number;
    if (seasonIdParam) {
      seasonId = parseInt(seasonIdParam);
    } else {
      const activeSeason = await prisma.season.findFirst({
        where: { eventId, isActive: true },
        orderBy: { startDate: "desc" },
      });
      if (!activeSeason) {
        return NextResponse.json({ message: "No active season for this event" }, { status: 404 });
      }
      seasonId = activeSeason.id;
    }

    const stations = await prisma.raceStation.findMany({
      where: { seasonId },
      orderBy: { miles: "asc" },
      include: { stationRaceTypes: { include: { raceType: true } } },
    });
    return NextResponse.json({ stations, message: "ok" });
  } catch (error) {
    console.error("Error listing stations:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
