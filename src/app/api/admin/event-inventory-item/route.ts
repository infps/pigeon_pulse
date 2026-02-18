import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { PaymentStatus } from "@/generated/prisma/enums";

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
      eventInventoryId,
      breederId,
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

    // Get the event inventory to find the event
    const eventInventory = await prisma.eventInventory.findUnique({
      where: { eventInventoryId },
      include: {
        event: {
          include: {
            feeScheme: true,
          },
        },
        eventInventoryItems: true,
      },
    });

    if (!eventInventory) {
      return NextResponse.json(
        { message: "Event inventory not found" },
        { status: 404 }
      );
    }

    // Check if adding this bird would exceed the reserved birds limit
    const currentBirdCount = eventInventory.eventInventoryItems.length;
    if (currentBirdCount >= eventInventory.reservedBirds) {
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
          sex,
          rfid,
          isActive: isActive ?? true,
          isLost: isLost ?? false,
          lostDate: lostDate ? new Date(lostDate) : null,
          lostRaceId: lostRaceId || null,
          note: note || null,
          breederId,
        },
      });

      // Create the event inventory item
      const eventInventoryItem = await tx.eventInventoryItem.create({
        data: {
          eventInventoryId,
          birdId: bird.birdId,
          arrivalTime: arrivalTime ? new Date(arrivalTime) : null,
          departureTime: departureTime ? new Date(departureTime) : null,
          isBackup: isBackup ?? false,
          belgianShowBet1: belgianShowBet1 ?? false,
          belgianShowBet2: belgianShowBet2 ?? false,
          belgianShowBet3: belgianShowBet3 ?? false,
          belgianShowBet4: belgianShowBet4 ?? false,
          belgianShowBet5: belgianShowBet5 ?? false,
          belgianShowBet6: belgianShowBet6 ?? false,
          belgianShowBet7: belgianShowBet7 ?? false,
          standardShowBet1: standardShowBet1 ?? false,
          standardShowBet2: standardShowBet2 ?? false,
          standardShowBet3: standardShowBet3 ?? false,
          standardShowBet4: standardShowBet4 ?? false,
          standardShowBet5: standardShowBet5 ?? false,
          wtaBet1: wtaBet1 ?? false,
          wtaBet2: wtaBet2 ?? false,
          wtaBet3: wtaBet3 ?? false,
          wtaBet4: wtaBet4 ?? false,
          wtaBet5: wtaBet5 ?? false,
        },
        include: {
          bird: true,
        },
      });

      // Create payment entries if fee scheme exists
      if (eventInventory.event.feeScheme) {
        const feeScheme = eventInventory.event.feeScheme;

        // Create purge fee payment
        if (feeScheme.perchFee > 0) {
          await tx.payments.create({
            data: {
              eventInventoryId,
              breederId,
              amountToPay: feeScheme.perchFee,
              amountPaid: 0,
              currency: "USD",
              method: "CASH",
              status: PaymentStatus.PENDING,
              paymentType: "PERCH_FEE",
              description: `Purge fee for bird ${bird.band}`,
            },
          });
        }

        // Get current bird count for this event inventory to determine perch fee
        const birdCount = await tx.eventInventoryItem.count({
          where: { eventInventoryId },
        });

        // Find perch fee for this bird number
        const birdFeeItem = await tx.birdFeeItem.findFirst({
          where: {
            feeSchemeId: feeScheme.id,
            birdNo: birdCount,
          },
        });

        if (birdFeeItem && birdFeeItem.fee > 0) {
          await tx.payments.create({
            data: {
              eventInventoryId,
              breederId,
              amountToPay: birdFeeItem.fee,
              amountPaid: 0,
              currency: "USD",
              method: "CASH",
              status: PaymentStatus.PENDING,
              paymentType: "BIRD_FEE",
              description: `Per bird fee for bird #${birdCount} (${bird.band})`,
            },
          });
        }
      }

      // Increment the reserved birds count
      await tx.eventInventory.update({
        where: { eventInventoryId },
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
