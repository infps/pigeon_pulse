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
  sex: z.union([z.string(), z.number()]).optional(),
  rfid: z.string().optional().nullable(),
  isActive: z.union([z.boolean(), z.number()]),
  isLost: z.union([z.boolean(), z.number()]),
  lostDate: z.string().optional().nullable(),
  lostRaceId: z.union([z.string(), z.number()]).optional().nullable(),
  note: z.string().optional().nullable(),

  // Event Inventory Item fields
  arrivalDate: z.string().optional().nullable(),
  departureDate: z.string().optional().nullable(),
  isBackup: z.union([z.boolean(), z.number()]),

  // Betting classes (Float, not Boolean)
  belgianShowBet1: z.number().optional().nullable(),
  belgianShowBet2: z.number().optional().nullable(),
  belgianShowBet3: z.number().optional().nullable(),
  belgianShowBet4: z.number().optional().nullable(),
  belgianShowBet5: z.number().optional().nullable(),
  belgianShowBet6: z.number().optional().nullable(),
  belgianShowBet7: z.number().optional().nullable(),
  standardShowBet1: z.number().optional().nullable(),
  standardShowBet2: z.number().optional().nullable(),
  standardShowBet3: z.number().optional().nullable(),
  standardShowBet4: z.number().optional().nullable(),
  standardShowBet5: z.number().optional().nullable(),
  wtaBet1: z.number().optional().nullable(),
  wtaBet2: z.number().optional().nullable(),
  wtaBet3: z.number().optional().nullable(),
  wtaBet4: z.number().optional().nullable(),
  wtaBet5: z.number().optional().nullable(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventInventoryItemId: string }> }
) {
  const { eventInventoryItemId: eventInventoryItemIdParam } = await params;
  const eventInventoryItemId = parseInt(eventInventoryItemIdParam);

  if (isNaN(eventInventoryItemId)) {
    return NextResponse.json({ message: "Invalid event inventory item ID" }, { status: 400 });
  }

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
      where: { id: eventInventoryItemId },
      include: { bird: true },
    });

    if (!eventInventoryItem) {
      return NextResponse.json(
        { message: "Event inventory item not found" },
        { status: 404 }
      );
    }
    if(body.rfid && eventInventoryItem.birdId){
      const existingBirdWithRfid = await prisma.bird.findFirst({
        where: {
          rfid: body.rfid,
          id: { not: eventInventoryItem.birdId },
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
        where: { id: eventInventoryItem.birdId! },
        data: {
          band1: validatedData.band1,
          band2: validatedData.band2,
          band3: validatedData.band3,
          band4: validatedData.band4,
          band: `${validatedData.band1}-${validatedData.band2}-${validatedData.band3}-${validatedData.band4}`,
          birdName: validatedData.birdName,
          color: validatedData.color,
          rfid: validatedData.rfid || null,
          isActive: validatedData.isActive ? 1 : 0,
          isLost: validatedData.isLost ? 1 : 0,
          lostDate: validatedData.lostDate ? new Date(validatedData.lostDate) : null,
          lostRaceId: validatedData.lostRaceId ? parseInt(String(validatedData.lostRaceId)) : null,
          note: validatedData.note || null,
        },
      });

      // Update the event inventory item
      const updatedEventInventoryItem = await tx.eventInventoryItem.update({
        where: { id: eventInventoryItemId },
        data: {
          arrivalDate: validatedData.arrivalDate ? new Date(validatedData.arrivalDate) : null,
          departureDate: validatedData.departureDate ? new Date(validatedData.departureDate) : null,
          isBackup: validatedData.isBackup ? 1 : 0,
          belgianShowBet1: validatedData.belgianShowBet1 ?? null,
          belgianShowBet2: validatedData.belgianShowBet2 ?? null,
          belgianShowBet3: validatedData.belgianShowBet3 ?? null,
          belgianShowBet4: validatedData.belgianShowBet4 ?? null,
          belgianShowBet5: validatedData.belgianShowBet5 ?? null,
          belgianShowBet6: validatedData.belgianShowBet6 ?? null,
          belgianShowBet7: validatedData.belgianShowBet7 ?? null,
          standardShowBet1: validatedData.standardShowBet1 ?? null,
          standardShowBet2: validatedData.standardShowBet2 ?? null,
          standardShowBet3: validatedData.standardShowBet3 ?? null,
          standardShowBet4: validatedData.standardShowBet4 ?? null,
          standardShowBet5: validatedData.standardShowBet5 ?? null,
          wtaBet1: validatedData.wtaBet1 ?? null,
          wtaBet2: validatedData.wtaBet2 ?? null,
          wtaBet3: validatedData.wtaBet3 ?? null,
          wtaBet4: validatedData.wtaBet4 ?? null,
          wtaBet5: validatedData.wtaBet5 ?? null,
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
