import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const scanSchema = z.object({
  ringNo: z.string(),
  timestamp: z.string(),
  antenna: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ raceId: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { raceId } = await params;
    const raceIdInt = parseInt(raceId);
    const body = await request.json();

    const validatedData = scanSchema.parse(body);
    const { ringNo, timestamp } = validatedData;

    const race = await prisma.race.findUnique({
      where: { id: raceIdInt },
    });

    if (!race) {
      return NextResponse.json(
        { message: "Race not found" },
        { status: 404 }
      );
    }

    // Find the bird by band or rfid
    const bird = await prisma.bird.findFirst({
      where: {
        OR: [
          { band: ringNo },
          { rfid: ringNo },
        ]
      },
    });

    if (!bird) {
      return NextResponse.json(
        { message: `Bird with ring number ${ringNo} not found` },
        { status: 404 }
      );
    }

    // Find the race item for this bird in this race (through inventoryItem)
    const raceItem = await prisma.raceItem.findFirst({
      where: {
        raceId: raceIdInt,
        inventoryItem: {
          birdId: bird.id,
        },
      },
    });

    if (!raceItem) {
      return NextResponse.json(
        { message: `Bird ${ringNo} is not registered for this race` },
        { status: 404 }
      );
    }

    // Determine if race is live: startTime is set and not closed
    const isLive = race.startTime !== null && race.isClosed !== 1;

    // Pre-race scan (dist basketing)
    if (!isLive) {
      if (raceItem.isDistBasketed === 1) {
        return NextResponse.json(
          {
            raceItem,
            message: "Bird already in dist basket",
            isNewScan: false,
            scanType: "loft",
          },
          { status: 200 }
        );
      }

      const updatedRaceItem = await prisma.raceItem.update({
        where: { id: raceItem.id },
        data: {
          isDistBasketed: 1,
        },
        include: {
          inventoryItem: {
            include: {
              bird: {
                include: {
                  breeder: {
                    select: {
                      firstName: true,
                      lastName: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      return NextResponse.json(
        {
          raceItem: updatedRaceItem,
          message: "Bird added to dist basket",
          isNewScan: true,
          scanType: "loft",
        },
        { status: 200 }
      );
    }

    // Post-race scan (arrival)
    // Parse the timestamp from scanner format (YYYYMMDDHHMMSS)
    const arrivalTime = new Date(
      parseInt(timestamp.substring(0, 4)),
      parseInt(timestamp.substring(4, 6)) - 1,
      parseInt(timestamp.substring(6, 8)),
      parseInt(timestamp.substring(8, 10)),
      parseInt(timestamp.substring(10, 12)),
      parseInt(timestamp.substring(12, 14))
    );

    // Already scanned post-race
    if (raceItem.raceBasketId !== null) {
      return NextResponse.json(
        {
          raceItem,
          message: "Bird already scanned",
          isNewScan: false,
          scanType: "arrival",
        },
        { status: 200 }
      );
    }

    // Calculate position
    const arrivedCount = await prisma.raceItem.count({
      where: {
        raceId: raceIdInt,
        raceBasketId: { not: null },
      },
    });
    const birdPosition = arrivedCount + 1;

    const updatedRaceItem = await prisma.raceItem.update({
      where: { id: raceItem.id },
      data: {
        raceBasketTime: arrivalTime,
      },
      include: {
        inventoryItem: {
          include: {
            bird: {
              include: {
                breeder: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Upsert race item result for arrival
    await prisma.raceItemResult.upsert({
      where: { raceItemId: raceItem.id },
      create: {
        raceItemId: raceItem.id,
        arrivalTime,
        birdPosition,
      },
      update: {
        arrivalTime,
        birdPosition,
      },
    });

    return NextResponse.json(
      {
        raceItem: updatedRaceItem,
        message: "Arrival recorded successfully",
        isNewScan: true,
        scanType: "arrival",
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid request data", errors: error },
        { status: 400 }
      );
    }

    console.error("Error recording scan:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
