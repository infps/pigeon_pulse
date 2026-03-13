import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateFees } from "@/lib/fee-calculator";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import z from "zod";

// Define the bird schema — either existing bird by ID or new bird details
const birdSchema = z.union([
  z.object({ birdId: z.number().int().positive() }),
  z.object({
    name: z.string().min(1, "Bird name is required"),
    color: z.string().min(1, "Bird color is required"),
    sex: z.enum(["COCK", "HEN", "UNKNOWN"]),
    band1: z.string().min(1, "Band 1 is required"),
    band2: z.string().min(1, "Band 2 is required"),
    band3: z.string().min(1, "Band 3 is required"),
    band4: z.string().min(1, "Band 4 is required"),
  }),
]);

// Birds array is optional — admin can register slots without specifying birds upfront
const registrationSchema = z.object({
  breederId: z.union([z.string(), z.number()]).transform(v => typeof v === 'string' ? parseInt(v) : v),
  loftName: z.string().min(1, "Loft name is required"),
  reservedBirds: z.number().int().positive("Reserved birds must be a positive integer"),
  birds: z.array(birdSchema).optional().default([]),
  note: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session || !session.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { eventId: eventIdParam } = await params;
    const eventId = parseInt(eventIdParam);
    if (isNaN(eventId)) {
      return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = registrationSchema.parse(body);
    const breederId = validatedData.breederId;

    // Check if event exists and is open
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        feeScheme: {
          include: {
            birdFeeItems: { orderBy: { birdNo: "asc" } },
            raceTypeFees: true,
          },
        },
        races: true,
      },
    });

    if (!event) {
      return NextResponse.json(
        { message: "Event not found" },
        { status: 404 }
      );
    }

    if (!event.isOpen) {
      return NextResponse.json(
        { message: "Event registration is closed" },
        { status: 400 }
      );
    }

    // Check if breeder exists
    const breeder = await prisma.breeder.findUnique({
      where: { id: breederId },
    });

    if (!breeder) {
      return NextResponse.json(
        { message: "Breeder not found" },
        { status: 404 }
      );
    }

    // Use a transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Create EventInventory
      const eventInventory = await tx.eventInventory.create({
        data: {
          eventId,
          breederId,
          loft: validatedData.loftName,
          reservedBirds: validatedData.reservedBirds,
          note: validatedData.note,
        },
      });

      // Create or find birds and add them to EventInventoryItems
      const inventoryItems: { birdId: number; id: number }[] = [];
      for (const birdData of validatedData.birds) {
        let bird;

        if ("birdId" in birdData) {
          // Use existing bird — verify it belongs to this breeder
          bird = await tx.bird.findUnique({ where: { id: birdData.birdId } });
          if (!bird || bird.breederId !== breederId) {
            throw new Error(`Bird ${birdData.birdId} not found or does not belong to this breeder`);
          }
        } else {
          // Create unique band identifier
          const band = `${birdData.band1}-${birdData.band2}-${birdData.band3}-${birdData.band4}`;

          // Check if bird already exists by band
          bird = await tx.bird.findFirst({ where: { band } });

          // If bird doesn't exist, create it
          if (!bird) {
            bird = await tx.bird.create({
              data: {
                band,
                band1: birdData.band1,
                band2: birdData.band2,
                band3: birdData.band3,
                band4: birdData.band4,
                birdName: birdData.name,
                color: birdData.color,
                sex: birdData.sex === "COCK" ? 1 : birdData.sex === "HEN" ? 2 : 0,
                breederId,
                isActive: 1,
                isLost: 0,
              },
            });
          }
        }

        // Create EventInventoryItem
        const item = await tx.eventInventoryItem.create({
          data: {
            birdId: bird.id,
            eventInventoryId: eventInventory.id,
          },
        });

        inventoryItems.push({ birdId: item.birdId!, id: item.id });
      }

      // Add birds to any existing races for this event
      const existingRaces = await tx.race.findMany({
        where: { eventId },
        select: { id: true },
      });
      if (existingRaces.length > 0) {
        const raceItemData = existingRaces.flatMap((race) =>
          inventoryItems.map((item) => ({
            raceId: race.id,
            inventoryItemId: item.id,
          }))
        );
        await tx.raceItem.createMany({ data: raceItemData });
      }

      // Calculate fees and populate EventInventoryItem fee fields
      if (event.feeScheme) {
        const fees = calculateFees({
          numBirds: validatedData.reservedBirds,
          feeScheme: {
            ...event.feeScheme,
            birdFeeItems: event.feeScheme.birdFeeItems || [],
            raceTypeFees: event.feeScheme.raceTypeFees || [],
          },
          races: event.races || [],
        });

        // Update each inventory item with per-bird fees
        const raceFeePerBird = validatedData.reservedBirds > 0
          ? fees.raceFees / validatedData.reservedBirds
          : 0;

        for (let i = 0; i < inventoryItems.length; i++) {
          const birdBreakdown = fees.perBirdBreakdown[i];
          await tx.eventInventoryItem.update({
            where: { id: inventoryItems[i].id },
            data: {
              entryFeeValue: i === 0 ? fees.purgeFee : 0, // purge fee on first bird only
              perchFeeValue: birdBreakdown?.perchFee ?? 0,
              hotSpotFeeValue: birdBreakdown?.hotspotFee ?? 0,
              raceFeeValue: raceFeePerBird,
            },
          });
        }

        // Create Payment record
        await tx.payment.create({
          data: {
            eventInventoryId: eventInventory.id,
            breederId,
            paymentValue: fees.total,
            paymentDate: new Date(),
            paymentTimestamp: new Date(),
            paymentDesc: `Registration: ${validatedData.reservedBirds} birds`,
            status: "PENDING",
          },
        });
      }

      return {
        eventInventory,
        inventoryItems,
      };
    });

    return NextResponse.json(
      {
        message: "Registration successful",
        data: result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error registering for event:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          message: "Validation error",
          errors: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
