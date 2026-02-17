import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;

    const event = await prisma.event.findUnique({
      where: { eventId },
      include: {
        type: true,
        feeScheme: {
          include: {
            birdFeeItems: {
              orderBy: {
                birdNo: "asc",
              },
            },
            raceTypes: {
              include: {
                raceType: true,
              },
            },
          },
        },
        prizeScheme: {
          include: {
            prizeSchemeItems: {
              include: {
                raceType: true,
              },
              orderBy: [
                { raceTypeId: "asc" },
                { fromPosition: "asc" },
              ],
            },
          },
        },
        bettingScheme: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        races: {
          include: {
            raceType: true,
          },
          orderBy: {
            releaseDate: "asc",
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

    return NextResponse.json({ event });
  } catch (error) {
    console.error("Error fetching event details:", error);
    return NextResponse.json(
      { error: "Failed to fetch event details" },
      { status: 500 }
    );
  }
}
