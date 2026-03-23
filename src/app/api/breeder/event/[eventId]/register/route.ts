import { auth } from "@/lib/auth";
import { getOrCreateBreeder } from "@/lib/get-or-create-breeder";
import { prisma } from "@/lib/prisma";
import { PaymentStatus } from "@/generated/prisma/enums";
import { calculateFees } from "@/lib/fee-calculator";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import z from "zod";

// Define the bird schema for registration
const birdSchema = z.object({
  name: z.string().min(1, "Bird name is required"),
  color: z.string().min(1, "Bird color is required"),
  sex: z.number().int().min(0).max(2),
  band1: z.string().min(1, "Band 1 is required"),
  band2: z.string().min(1, "Band 2 is required"),
  band3: z.string().min(1, "Band 3 is required"),
  band4: z.string().min(1, "Band 4 is required"),
});

// Define the registration schema (breederId comes from session, not request)
const registrationSchema = z.object({
  loftName: z.string().min(1, "Loft name is required"),
  reservedBirds: z.number().int().positive("Reserved birds must be a positive integer"),
  birds: z.array(birdSchema),
  note: z.string().optional(),
}).refine(
  (data) => data.birds.length === data.reservedBirds,
  {
    message: "Number of birds must equal reserved birds count",
    path: ["birds"],
  }
);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session || !session.user || session.user.role !== "BREEDER") {
      return NextResponse.json(
        { message: "Unauthorized. Must be logged in as a breeder." },
        { status: 401 }
      );
    }

    const breeder = await getOrCreateBreeder(session.user.id, session.user.email, session.user.name);
    const breederId = breeder.id;

    const { eventId: eventIdParam } = await params;
    const eventId = parseInt(eventIdParam);
    if (isNaN(eventId)) {
      return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = registrationSchema.parse(body);

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

    // Check if breeder has already registered for this event with same loft
    const existingRegistration = await prisma.eventInventory.findFirst({
      where: {
        eventId,
        breederId,
        loft: validatedData.loftName,
      },
    });

    if (existingRegistration) {
      return NextResponse.json(
        { message: "You have already registered for this event with this loft" },
        { status: 400 }
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
        // Create unique band identifier
        const band = `${birdData.band1}-${birdData.band2}-${birdData.band3}-${birdData.band4}`;

        // Check if bird already exists
        let bird = await tx.bird.findFirst({
          where: { band },
        });

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
              sex: birdData.sex,
              breederId,
              isActive: 1,
              isLost: 0,
            },
          });
        } else {
          // If bird exists but belongs to a different breeder, return error
          if (bird.breederId !== breederId) {
            throw new Error(`Bird with band ${band} is already registered to another breeder`);
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

      // Add birds to races still accepting registrations
      const existingRaces = await tx.race.findMany({
        where: { eventId, status: "REGISTERING" },
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

        const raceFeePerBird = validatedData.reservedBirds > 0
          ? fees.raceFees / validatedData.reservedBirds
          : 0;

        for (let i = 0; i < inventoryItems.length; i++) {
          const birdBreakdown = fees.perBirdBreakdown[i];
          await tx.eventInventoryItem.update({
            where: { id: inventoryItems[i].id },
            data: {
              entryFeeValue: i === 0 ? fees.purgeFee : 0,
              perchFeeValue: birdBreakdown?.perchFee ?? 0,
              hotSpotFeeValue: birdBreakdown?.hotspotFee ?? 0,
              raceFeeValue: raceFeePerBird,
            },
          });
        }

        // Create Payment record (PENDING - breeder pays later or via PayPal)
        await tx.payment.create({
          data: {
            eventInventoryId: eventInventory.id,
            breederId,
            paymentValue: fees.total,
            paymentDate: new Date(),
            paymentTimestamp: new Date(),
            paymentDesc: `Registration: ${validatedData.reservedBirds} birds`,
            status: PaymentStatus.PENDING,
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

    if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
