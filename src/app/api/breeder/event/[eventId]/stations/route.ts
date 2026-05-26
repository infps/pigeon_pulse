import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId: eventIdParam } = await params;
    const eventId = parseInt(eventIdParam);
    if (isNaN(eventId)) {
      return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
    }
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
