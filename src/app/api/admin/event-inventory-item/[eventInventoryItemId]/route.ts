import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateEventInventoryItemSchema = z.object({
  // Bird fields
  band1: z.string().min(1),
  band2: z.string().min(1),
  band3: z.string().min(1),
  band4: z.string().min(1),
  birdName: z.string().min(1),
  color: z.string().min(1),
  sex: z.enum(["COCK", "HEN", "UNKNOWN"]),
  rfid: z.string().optional().nullable(),
  isActive: z.boolean(),
  isLost: z.boolean(),
  lostDate: z.string().optional().nullable(),
  lostRaceId: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  
  // Event Inventory Item fields
  arrivalTime: z.string().optional().nullable(),
  departureTime: z.string().optional().nullable(),
  isBackup: z.boolean(),
  
  // Betting classes
  belgianShowBet1: z.boolean(),
  belgianShowBet2: z.boolean(),
  belgianShowBet3: z.boolean(),
  belgianShowBet4: z.boolean(),
  belgianShowBet5: z.boolean(),
  belgianShowBet6: z.boolean(),
  belgianShowBet7: z.boolean(),
  standardShowBet1: z.boolean(),
  standardShowBet2: z.boolean(),
  standardShowBet3: z.boolean(),
  standardShowBet4: z.boolean(),
  standardShowBet5: z.boolean(),
  wtaBet1: z.boolean(),
  wtaBet2: z.boolean(),
  wtaBet3: z.boolean(),
  wtaBet4: z.boolean(),
  wtaBet5: z.boolean(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventInventoryItemId: string }> }
) {
  const { eventInventoryItemId } = await params;

  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session || !session.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = updateEventInventoryItemSchema.parse(body);

    // Get the event inventory item to find the bird
    const eventInventoryItem = await prisma.eventInventoryItem.findUnique({
      where: { eventInventoryItemId },
      include: { bird: true },
    });

    if (!eventInventoryItem) {
      return NextResponse.json(
        { message: "Event inventory item not found" },
        { status: 404 }
      );
    }
    if(body.rfid){
      const existingBirdWithRfid = await prisma.bird.findFirst({
        where: {
          rfid: body.rfid,
          birdId: { not: eventInventoryItem.birdId },
        },
      });
      if (existingBirdWithRfid) {
        return NextResponse.json(
          { message: "RFID already in use by another bird" },
          { status: 400 }
        );
      }
    }
    // Update both bird and event inventory item in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update the bird
      const updatedBird = await tx.bird.update({
        where: { birdId: eventInventoryItem.birdId },
        data: {
          band1: validatedData.band1,
          band2: validatedData.band2,
          band3: validatedData.band3,
          band4: validatedData.band4,
          band: `${validatedData.band1}-${validatedData.band2}-${validatedData.band3}-${validatedData.band4}`,
          birdName: validatedData.birdName,
          color: validatedData.color,
          sex: validatedData.sex,
          rfid: validatedData.rfid || null,
          isActive: validatedData.isActive,
          isLost: validatedData.isLost,
          lostDate: validatedData.lostDate ? new Date(validatedData.lostDate) : null,
          lostRaceId: validatedData.lostRaceId || null,
          note: validatedData.note || null,
        },
      });

      // Update the event inventory item
      const updatedEventInventoryItem = await tx.eventInventoryItem.update({
        where: { eventInventoryItemId },
        data: {
          arrivalTime: validatedData.arrivalTime ? new Date(validatedData.arrivalTime) : null,
          departureTime: validatedData.departureTime ? new Date(validatedData.departureTime) : null,
          isBackup: validatedData.isBackup,
          belgianShowBet1: validatedData.belgianShowBet1,
          belgianShowBet2: validatedData.belgianShowBet2,
          belgianShowBet3: validatedData.belgianShowBet3,
          belgianShowBet4: validatedData.belgianShowBet4,
          belgianShowBet5: validatedData.belgianShowBet5,
          belgianShowBet6: validatedData.belgianShowBet6,
          belgianShowBet7: validatedData.belgianShowBet7,
          standardShowBet1: validatedData.standardShowBet1,
          standardShowBet2: validatedData.standardShowBet2,
          standardShowBet3: validatedData.standardShowBet3,
          standardShowBet4: validatedData.standardShowBet4,
          standardShowBet5: validatedData.standardShowBet5,
          wtaBet1: validatedData.wtaBet1,
          wtaBet2: validatedData.wtaBet2,
          wtaBet3: validatedData.wtaBet3,
          wtaBet4: validatedData.wtaBet4,
          wtaBet5: validatedData.wtaBet5,
        },
      });

      return { bird: updatedBird, eventInventoryItem: updatedEventInventoryItem };
    });

    return NextResponse.json(
      {
        ...result,
        message: "Event inventory item updated successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Validation error", errors: error.issues },
        { status: 400 }
      );
    }

    console.error("Error updating event inventory item:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
