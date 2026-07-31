import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: eventIdParam } = await params;
  const eventId = parseInt(eventIdParam);

  if (isNaN(eventId)) {
    return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
  }

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const seasons = await prisma.season.findMany({
      where: { eventId },
      orderBy: { startDate: "desc" },
    });

    const activeSeason = seasons.find((s) => s.isActive) ?? seasons[0] ?? null;

    return NextResponse.json({ seasons, activeSeasonId: activeSeason?.id ?? null });
  } catch (error) {
    console.error("Error fetching seasons:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: eventIdParam } = await params;
  const eventId = parseInt(eventIdParam);

  if (isNaN(eventId)) {
    return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
  }

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || session.user.role !== "SUPERADMIN") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, startDate, endDate } = body;

    if (!name || !startDate || !endDate) {
      return NextResponse.json({ message: "name, startDate, endDate are required" }, { status: 400 });
    }

    // Deactivate all seasons for this event, create new one as active
    await prisma.season.updateMany({ where: { eventId }, data: { isActive: false } });

    const season = await prisma.season.create({
      data: {
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: true,
        eventId,
      },
    });

    return NextResponse.json({ season }, { status: 201 });
  } catch (error) {
    console.error("Error creating season:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
