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
    const body = await request.json();

    const validatedData = scanSchema.parse(body);
    const { ringNo, timestamp } = validatedData;

    const race = await prisma.race.findUnique({
      where: { raceId },
    });

    if (!race) {
      return NextResponse.json(
        { message: "Race not found" },
        { status: 404 }
      );
    }

    // Find the bird by ring number or rfid
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

    // Find the race item for this bird in this race
    const raceItem = await prisma.raceItem.findFirst({
      where: {
        raceId,
        birdId: bird.birdId,
      },
    });

    if (!raceItem) {
      return NextResponse.json(
        { message: `Bird ${ringNo} is not registered for this race` },
        { status: 404 }
      );
    }

    // Pre-race scan (loft basketing)
    if (!race.isLive) {
      if (raceItem.status === "LOFT_BASKETED") {
        return NextResponse.json(
          {
            raceItem,
            message: "Bird already in loft basket",
            isNewScan: false,
            scanType: "loft",
          },
          { status: 200 }
        );
      }

      const updatedRaceItem = await prisma.raceItem.update({
        where: { raceItemId: raceItem.raceItemId },
        data: {
          status: "LOFT_BASKETED",
          isLoftBasketed: true,
        },
        include: {
          bird: {
            include: {
              breeder: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      return NextResponse.json(
        {
          raceItem: updatedRaceItem,
          message: "Bird added to loft basket",
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
    if (raceItem.status === "RACE_BASKETED") {
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
        raceId,
        status: "RACE_BASKETED",
      },
    });
    const birdPosition = arrivedCount + 1;

    const updatedRaceItem = await prisma.raceItem.update({
      where: { raceItemId: raceItem.raceItemId },
      data: {
        status: "RACE_BASKETED",
        isRaceBasketed: true,
        raceBasketedAt: arrivalTime,
        arrivalTime,
        birdPosition,
      },
      include: {
        bird: {
          include: {
            breeder: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
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
