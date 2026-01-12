import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const isOpen = searchParams.get("isOpen");

    const whereClause: any = {};

    // Filter by open/closed status if specified
    if (isOpen !== null) {
      whereClause.isOpen = isOpen === "true";
    }

    const events = await prisma.event.findMany({
      where: whereClause,
      include: {
        type: true,
        feeScheme: true,
        prizeScheme: true,
        bettingScheme: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        races: {
          select: {
            raceId: true,
            name: true,
            isLive: true,
            isClosed: true,
            releaseDate: true,
          },
          orderBy: {
            releaseDate: "asc",
          },
        },
        _count: {
          select: {
            races: true,
          },
        },
      },
      orderBy: {
        startDate: "desc",
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
