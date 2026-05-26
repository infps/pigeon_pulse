import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId: eventIdParam } = await params;
    const eventId = parseInt(eventIdParam);
    if (isNaN(eventId)) {
      return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
    }

    const races = await prisma.race.findMany({
      where: { eventId },
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
