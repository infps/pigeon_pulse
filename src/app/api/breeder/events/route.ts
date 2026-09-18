import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eventVisibilityFilter } from "@/lib/visibility";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const isOpen = searchParams.get("isOpen");

    const session = await auth.api.getSession({ headers: await headers() });

    // Private events are hidden unless this breeder is registered in one.
    const visibility = await eventVisibilityFilter(
      session?.user?.id,
      session?.user?.role
    );

    const whereClause: any = { ...visibility };

    // Filter by open/closed status if specified
    if (isOpen !== null) {
      whereClause.isOpen = isOpen === "true" ? 1 : 0;
    }

    const events = await prisma.event.findMany({
      where: whereClause,
      include: {
        eventType: true,
        createdBy: true,
        seasons: {
          include: {
            feeScheme: {
              include: {
                birdFeeItems: { orderBy: { birdNo: "asc" as const } },
                raceTypeFees: true,
              },
            },
            finalPrize: true,
            bettingScheme: true,
            races: {
              select: {
                id: true,
                description: true,
                isClosed: true,
                startTime: true,
                raceTypeId: true,
              },
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
