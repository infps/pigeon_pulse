import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPaymentStatus } from "@/lib/utils";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import z from "zod";

// Define the bird schema for registration
const birdSchema = z.object({
  name: z.string().min(1, "Bird name is required"),
  color: z.string().min(1, "Bird color is required"),
  sex: z.enum(["COCK", "HEN", "UNKNOWN"]),
  band1: z.string().min(1, "Band 1 is required"),
  band2: z.string().min(1, "Band 2 is required"),
  band3: z.string().min(1, "Band 3 is required"),
  band4: z.string().min(1, "Band 4 is required"),
});

// Define the payment schema
const paymentSchema = z.object({
  amountPaid: z.number().nonnegative("Amount paid must be non-negative"),
  amountToPay: z.number().nonnegative("Amount to pay must be non-negative"),
  currency: z.string().default("USD"),
  method: z.enum(["CREDIT_CARD", "PAYPAL", "BANK_TRANSFER", "CASH"]),
  description: z.string().optional(),
  paymentType: z.enum(["PERCH_FEE", "BIRD_FEE", "RACES_FEE", "PAYOUTS", "OTHER"]),
  referenceNumber: z.string().optional(),
});

// Define the registration schema
const registrationSchema = z.object({
  breederId: z.string().min(1, "Breeder ID is required"),
  loftName: z.string().min(1, "Loft name is required"),
  reservedBirds: z.number().int().positive("Reserved birds must be a positive integer"),
  birds: z.array(birdSchema),
  payments: z.array(paymentSchema).default([]),
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

    if (!session || !session.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { eventId } = await params;
    
    // Parse and validate request body
    const body = await request.json();
    const validatedData = registrationSchema.parse(body);

    // Check if event exists and is open
    const event = await prisma.event.findUnique({
      where: { eventId },
      include: {
        feeScheme: true,
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
    const breeder = await prisma.user.findUnique({
      where: { id: validatedData.breederId },
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
          breederId: validatedData.breederId,
          loft: validatedData.loftName,
          reservedBirds: validatedData.reservedBirds,
          note: validatedData.note,
        },
      });

      // Create or find birds and add them to EventInventoryItems
      const eventInventoryItems = [];
      for (const birdData of validatedData.birds) {
        // Create unique band identifier
        const band = `${birdData.band1}-${birdData.band2}-${birdData.band3}-${birdData.band4}`;

        // Check if bird already exists
        let bird = await tx.bird.findUnique({
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
              breederId: validatedData.breederId,
            },
          });
        }

        // Create EventInventoryItem
        const eventInventoryItem = await tx.eventInventoryItem.create({
          data: {
            birdId: bird.birdId,
            eventInventoryId: eventInventory.eventInventoryId,
          },
        });

        eventInventoryItems.push(eventInventoryItem);
      }

      // Add birds to any existing races for this event
      const existingRaces = await tx.race.findMany({
        where: { eventId },
        select: { raceId: true },
      });
      if (existingRaces.length > 0) {
        const raceItemData = existingRaces.flatMap((race) =>
          eventInventoryItems.map((item) => ({
            raceId: race.raceId,
            birdId: item.birdId,
            eventInventoryItemId: item.eventInventoryItemId,
          }))
        );
        await tx.raceItem.createMany({ data: raceItemData });
      }

      // Create payments
      const payments = [];
      for (const paymentData of validatedData.payments) {
        const status = getPaymentStatus(paymentData.amountPaid, paymentData.amountToPay);
        const payment = await tx.payments.create({
          data: {
            eventInventoryId: eventInventory.eventInventoryId,
            breederId: validatedData.breederId,
            amountPaid: paymentData.amountPaid,
            amountToPay: paymentData.amountToPay,
            currency: paymentData.currency,
            method: paymentData.method,
            status,
            description: paymentData.description,
            paymentType: paymentData.paymentType,
            referenceNumber: paymentData.referenceNumber,
          },
        });
        payments.push(payment);
      }

      return {
        eventInventory,
        eventInventoryItems,
        payments,
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
