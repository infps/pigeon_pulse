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
    const { ringNo, timestamp, antenna } = validatedData;

    // Check if race exists and is live
    const race = await prisma.race.findUnique({
      where: { raceId },
    });

    if (!race) {
      return NextResponse.json(
        { message: "Race not found" },
        { status: 404 }
      );
    }

    if (!race.isLive) {
      return NextResponse.json(
        { message: "Race is not live" },
        { status: 400 }
      );
    }

    // Find the bird by ring number
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

    // Parse the timestamp from scanner format (YYYYMMDDHHMMSS)
    const arrivalTime = new Date(
      parseInt(timestamp.substring(0, 4)), // year
      parseInt(timestamp.substring(4, 6)) - 1, // month (0-indexed)
      parseInt(timestamp.substring(6, 8)), // day
      parseInt(timestamp.substring(8, 10)), // hour
      parseInt(timestamp.substring(10, 12)), // minute
      parseInt(timestamp.substring(12, 14)) // second
    );

    // Update the race item with arrival time if not already set
    const updatedRaceItem = await prisma.raceItem.update({
      where: { raceItemId: raceItem.raceItemId },
      data: {
        arrivalTime: raceItem.arrivalTime ? raceItem.arrivalTime : arrivalTime,
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
        message: raceItem.arrivalTime 
          ? "Bird already scanned" 
          : "Arrival recorded successfully",
        isNewArrival: !raceItem.arrivalTime,
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
    
    console.error("Error recording arrival:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
