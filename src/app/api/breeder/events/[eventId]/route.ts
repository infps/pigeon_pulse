import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId: eventIdParam } = await params;
    const eventId = parseInt(eventIdParam);

    if (isNaN(eventId)) {
      return NextResponse.json({ error: "Invalid event ID" }, { status: 400 });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        eventType: true,
        createdBy: true,
        seasons: {
          include: {
            feeScheme: {
              include: {
                birdFeeItems: { orderBy: { birdNo: "asc" } },
                raceTypeFees: { include: { raceType: true } },
              },
            },
            finalPrize: {
              include: {
                prizeSchemeItems: { orderBy: [{ fromPosition: "asc" }] },
              },
            },
            bettingScheme: true,
            races: {
              include: { raceType: true },
              orderBy: { startTime: "asc" },
            },
          },
        },
        _count: {
          select: {
            seasons: true,
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    // find active season to count birds via seasonId
    const activeSeason = event.seasons.find((s: any) => s.isActive) ?? event.seasons[0];
    const birdCount = activeSeason
      ? await prisma.eventInventoryItem.count({
          where: { eventInventory: { seasonId: activeSeason.id } },
        })
      : 0;

    const raceCount = event.seasons.reduce((acc: number, s: any) => acc + (s.races?.length ?? 0), 0);

    return NextResponse.json({
      event,
      stats: {
        breeders: event._count.seasons,
        birds: birdCount,
        races: raceCount,
      },
    });
  } catch (error) {
    console.error("Error fetching event details:", error);
    return NextResponse.json(
      { error: "Failed to fetch event details" },
      { status: 500 }
    );
  }
}
