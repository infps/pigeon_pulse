import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ raceId: string }> }
) {
  try {
    const { raceId } = await params;

    if (!raceId) {
      return NextResponse.json(
        { message: "Race ID is required" },
        { status: 400 }
      );
    }

    const raceIdInt = parseInt(raceId);

    const raceItems = await prisma.raceItem.findMany({
      where: { raceId: raceIdInt },
      include: {
        inventoryItem: {
          include: {
            bird: {
              include: {
                breeder: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
        result: true,
      },
      orderBy: [
        { result: { birdPosition: "asc" } },
        { result: { arrivalTime: "asc" } },
      ],
    });

    // Flatten nested relations for UI column accessors (matches admin API shape)
    const flattenedRaceItems = raceItems.map((item) => ({
      ...item,
      bird: item.inventoryItem?.bird ?? undefined,
      birdPosition: item.result?.birdPosition ?? null,
      arrivalTime: item.result?.arrivalTime ?? null,
    }));

    return NextResponse.json(
      { raceItems: flattenedRaceItems, message: "Race items fetched successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching race items:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
