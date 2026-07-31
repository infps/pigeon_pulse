import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: eventIdParam } = await params;
  const eventId = parseInt(eventIdParam);

  if (isNaN(eventId)) {
    return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
  }

  try {
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

    const eventInventoryItems = await prisma.eventInventoryItem.findMany({
      where: {
        eventInventory: {
          seasonId,
        },
      },
      include: {
        bird: true,
        eventInventory: {
          include: {
            breeder: true,
          },
        },
        raceItems: {
          include: {
            race: { select: { id: true, name: true } },
            result: true,
          },
        },
      },
      orderBy: {
        eventInventory: {
          signInDate: "desc",
        },
      },
    });

    return NextResponse.json(
      {
        eventInventoryItems,
        message: "Event inventory items fetched successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching event inventory items:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
