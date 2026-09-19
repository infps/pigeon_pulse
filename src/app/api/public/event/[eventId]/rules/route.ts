import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * The published rules and fees for an event, readable without an account.
 *
 * Rules are what a breeder agrees to by entering, so they stay public even when
 * the rest of an event is gated — a person deciding whether to enter has to be
 * able to read the terms first.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const eventIdInt = parseInt(eventId, 10);
    if (Number.isNaN(eventIdInt)) {
      return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
    }

    const seasonParam = new URL(request.url).searchParams.get("seasonId");
    const seasonId = seasonParam ? parseInt(seasonParam, 10) : null;

    const season =
      seasonId != null && !Number.isNaN(seasonId)
        ? await prisma.season.findFirst({
            where: { id: seasonId, eventId: eventIdInt },
            select: { id: true, name: true, startDate: true, endDate: true },
          })
        : await prisma.season.findFirst({
            where: { eventId: eventIdInt, isActive: true },
            orderBy: { startDate: "desc" },
            select: { id: true, name: true, startDate: true, endDate: true },
          });

    if (!season) {
      return NextResponse.json({ message: "No season found for this event" }, { status: 404 });
    }

    const [event, sections] = await Promise.all([
      prisma.event.findUnique({
        where: { id: eventIdInt },
        select: {
          id: true,
          name: true,
          shortName: true,
          logoImage: true,
          contactName: true,
          contactEmail: true,
          contactPhone: true,
          contactAddress: true,
        },
      }),
      prisma.eventRuleSection.findMany({
        where: { seasonId: season.id, isPublished: true },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: { id: true, title: true, body: true, updatedAt: true },
      }),
    ]);

    if (!event) {
      return NextResponse.json({ message: "Event not found" }, { status: 404 });
    }

    return NextResponse.json({ event, season, sections });
  } catch (error) {
    console.error("Failed to load public rules:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
