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
        feeScheme: {
          include: {
            birdFeeItems: {
              orderBy: {
                birdNo: "asc",
              },
            },
            raceTypeFees: {
              include: {
                raceType: true,
              },
            },
          },
        },
        finalPrize: {
          include: {
            prizeSchemeItems: {
              orderBy: [
                { fromPosition: "asc" },
              ],
            },
          },
        },
        bettingScheme: true,
        createdBy: true,
        races: {
          include: {
            raceType: true,
          },
          orderBy: {
            startTime: "asc",
          },
        },
        _count: {
          select: {
            races: true,
            eventInventories: true,
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

    const birdCount = await prisma.eventInventoryItem.count({
      where: { eventInventory: { eventId } },
    });

    return NextResponse.json({
      event,
      stats: {
        breeders: event._count.eventInventories,
        birds: birdCount,
        races: event._count.races,
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
