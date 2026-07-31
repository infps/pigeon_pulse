import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      eventInventoryId: eventInventoryIdParam,
      breederId: breederIdParam,
      band1,
      band2,
      band3,
      band4,
      birdName,
      color,
      sex,
      rfid,
      isActive,
      isLost,
      lostDate,
      lostRaceId,
      note,
      arrivalTime,
      departureTime,
      isBackup,
      belgianShowBet1,
      belgianShowBet2,
      belgianShowBet3,
      belgianShowBet4,
      belgianShowBet5,
      belgianShowBet6,
      belgianShowBet7,
      standardShowBet1,
      standardShowBet2,
      standardShowBet3,
      standardShowBet4,
      standardShowBet5,
      wtaBet1,
      wtaBet2,
      wtaBet3,
      wtaBet4,
      wtaBet5,
    } = body;

    const eventInventoryId = parseInt(eventInventoryIdParam);
    const breederId = parseInt(breederIdParam);

    // Get the event inventory to find the event
    const eventInventory = await prisma.eventInventory.findUnique({
      where: { id: eventInventoryId },
      include: {
        season: {
          include: {
            feeScheme: true,
          },
        },
        items: true,
      },
    });

    if (!eventInventory) {
      return NextResponse.json(
        { message: "Event inventory not found" },
        { status: 404 }
      );
    }

    // Check if adding this bird would exceed the reserved birds limit
    const currentBirdCount = eventInventory.items.length;
    if (eventInventory.reservedBirds && currentBirdCount >= eventInventory.reservedBirds) {
      return NextResponse.json(
        {
          message: `Cannot add bird. Maximum number of birds (${eventInventory.reservedBirds}) already reached. Current count: ${currentBirdCount}`
        },
        { status: 400 }
      );
    }

    // Create bird and event inventory item in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the bird
      const bird = await tx.bird.create({
        data: {
          band1,
          band2,
          band3,
          band4,
          band: `${band1}-${band2}-${band3}-${band4}`,
          birdName,
          color,
          sex: typeof sex === 'number' ? sex : 0,
          rfid,
          isActive: isActive != null ? (isActive ? 1 : 0) : 1,
          isLost: isLost != null ? (isLost ? 1 : 0) : 0,
          lostDate: lostDate ? new Date(lostDate) : null,
          lostRaceId: lostRaceId ? parseInt(lostRaceId) : null,
          note: note || null,
          breederId,
        },
      });

      // Create the event inventory item
      const eventInventoryItem = await tx.eventInventoryItem.create({
        data: {
          eventInventoryId,
          birdId: bird.id,
          arrivalDate: arrivalTime ? new Date(arrivalTime) : null,
          departureDate: departureTime ? new Date(departureTime) : null,
          isBackup: isBackup != null ? (isBackup ? 1 : 0) : 0,
          belgianShowBet1: belgianShowBet1 ?? null,
          belgianShowBet2: belgianShowBet2 ?? null,
          belgianShowBet3: belgianShowBet3 ?? null,
          belgianShowBet4: belgianShowBet4 ?? null,
          belgianShowBet5: belgianShowBet5 ?? null,
          belgianShowBet6: belgianShowBet6 ?? null,
          belgianShowBet7: belgianShowBet7 ?? null,
          standardShowBet1: standardShowBet1 ?? null,
          standardShowBet2: standardShowBet2 ?? null,
          standardShowBet3: standardShowBet3 ?? null,
          standardShowBet4: standardShowBet4 ?? null,
          standardShowBet5: standardShowBet5 ?? null,
          wtaBet1: wtaBet1 ?? null,
          wtaBet2: wtaBet2 ?? null,
          wtaBet3: wtaBet3 ?? null,
          wtaBet4: wtaBet4 ?? null,
          wtaBet5: wtaBet5 ?? null,
        },
        include: {
          bird: true,
        },
      });

      // Increment the reserved birds count
      await tx.eventInventory.update({
        where: { id: eventInventoryId },
        data: {
          reservedBirds: {
            increment: 1,
          },
        },
      });

      return eventInventoryItem;
    });

    return NextResponse.json(
      {
        eventInventoryItem: result,
        message: "Bird created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating bird:", error);
    return NextResponse.json(
      { message: "Internal server error", error: String(error) },
      { status: 500 }
    );
  }
}
