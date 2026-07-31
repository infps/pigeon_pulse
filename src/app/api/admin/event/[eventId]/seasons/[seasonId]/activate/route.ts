import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ eventId: string; seasonId: string }> }
) {
  const { eventId: eventIdParam, seasonId: seasonIdParam } = await params;
  const eventId = parseInt(eventIdParam);
  const seasonId = parseInt(seasonIdParam);

  if (isNaN(eventId) || isNaN(seasonId)) {
    return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
  }

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || session.user.role !== "SUPERADMIN") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const season = await prisma.season.findFirst({ where: { id: seasonId, eventId } });
    if (!season) {
      return NextResponse.json({ message: "Season not found for this event" }, { status: 404 });
    }

    // Deactivate all seasons for this event, then activate target
    await prisma.season.updateMany({ where: { eventId }, data: { isActive: false } });
    await prisma.season.update({ where: { id: seasonId }, data: { isActive: true } });

    return NextResponse.json({ message: "Season activated", season: { id: seasonId } });
  } catch (error) {
    console.error("Error activating season:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
