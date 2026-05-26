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

    const currentRace = await prisma.race.findUnique({
      where: { id: raceIdInt },
      select: { id: true, startTime: true },
    });

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
                    country: true,
                    user: {
                      select: { id: true, loftName: true, image: true },
                    },
                  },
                },
              },
            },
          },
        },
        result: true,
      },
      orderBy: [
        { result: { arrivalTime: "asc" } },
      ],
    });

    // Compute rank delta vs each bird's most recent prior race
    const birdIds = raceItems
      .map((it) => it.inventoryItem?.bird?.id)
      .filter((id): id is number => typeof id === "number");

    const priorByBird = new Map<number, number>();
    if (birdIds.length > 0 && currentRace?.startTime) {
      const priorItems = await prisma.raceItem.findMany({
        where: {
          raceId: { not: raceIdInt },
          inventoryItem: { bird: { id: { in: birdIds } } },
          result: { birdPosition: { not: null } },
          race: { startTime: { lt: currentRace.startTime } },
        },
        select: {
          inventoryItem: { select: { bird: { select: { id: true } } } },
          result: { select: { birdPosition: true } },
          race: { select: { startTime: true } },
        },
        orderBy: [{ race: { startTime: "desc" } }],
      });

      for (const p of priorItems) {
        const bid = p.inventoryItem?.bird?.id;
        const pos = p.result?.birdPosition;
        if (bid == null || pos == null) continue;
        if (!priorByBird.has(bid)) priorByBird.set(bid, pos);
      }
    }

    // Flatten nested relations for UI column accessors (matches admin API shape)
    const flattenedRaceItems = raceItems.map((item) => {
      const birdId = item.inventoryItem?.bird?.id ?? null;
      const previousPosition = birdId != null ? priorByBird.get(birdId) ?? null : null;
      return {
        ...item,
        bird: item.inventoryItem?.bird ?? undefined,
        birdPosition: item.result?.birdPosition ?? null,
        arrivalTime: item.result?.arrivalTime ?? null,
        previousPosition,
      };
    });

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
