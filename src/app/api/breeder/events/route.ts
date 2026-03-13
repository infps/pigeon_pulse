import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const isOpen = searchParams.get("isOpen");

    const whereClause: any = {};

    // Filter by open/closed status if specified
    if (isOpen !== null) {
      whereClause.isOpen = isOpen === "true" ? 1 : 0;
    }

    const events = await prisma.event.findMany({
      where: whereClause,
      include: {
        eventType: true,
        feeScheme: {
          include: {
            birdFeeItems: { orderBy: { birdNo: "asc" as const } },
            raceTypeFees: true,
          },
        },
        finalPrize: true,
        bettingScheme: true,
        createdBy: true,
        races: {
          select: {
            id: true,
            description: true,
            isClosed: true,
            startTime: true,
            raceTypeId: true,
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
      orderBy: {
        eventDate: "desc",
      },
    });

    return NextResponse.json({
      events,
      count: events.length,
    });
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}
