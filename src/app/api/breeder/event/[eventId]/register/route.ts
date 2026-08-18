import { auth } from "@/lib/auth";
import { getOrCreateBreeder } from "@/lib/get-or-create-breeder";
import { prisma } from "@/lib/prisma";
import { PaymentStatus } from "@/generated/prisma/enums";
import { calculateFees } from "@/lib/fee-calculator";
import { resolveTeamId } from "@/lib/resolve-team";
import { schemeTierAmount, type BetCategory } from "@/lib/betting-pools";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import z from "zod";

// Define the bird schema — either existing bird by ID or new bird details
const birdSchema = z.union([
  z.object({ birdId: z.number().int().positive() }),
  z.object({
    name: z.string().min(1, "Bird name is required"),
    color: z.string().min(1, "Bird color is required"),
    sex: z.number().int().min(0).max(2),
    band1: z.string().min(1, "Band 1 is required"),
    band2: z.string().min(1, "Band 2 is required"),
    band3: z.string().min(1, "Band 3 is required"),
    band4: z.string().min(1, "Band 4 is required"),
  }),
]);

// Owner bet selections, keyed by existing bird id. "All races, same pools":
// each selected pool enters that bird into the same tier in every REGISTERING race.
const betSelectionSchema = z.object({
  birdId: z.number().int().positive(),
  pools: z
    .array(
      z.object({
        category: z.enum(["BELGIAN", "STANDARD", "WTA"]),
        tierIndex: z.number().int().min(1).max(7),
      })
    )
    .default([]),
});

// Define the registration schema (breederId comes from session, not request)
const registrationSchema = z.object({
  loftName: z.string().min(1, "Loft name is required"),
  reservedBirds: z.number().int().positive("Reserved birds must be a positive integer"),
  birds: z.array(birdSchema).optional().default([]),
  bets: z.array(betSelectionSchema).optional().default([]),
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

    const url = new URL(request.url);
    const seasonIdParam = url.searchParams.get("seasonId");
    let seasonId: number;
    if (seasonIdParam) {
      seasonId = parseInt(seasonIdParam);
    } else {
      const activeSeason = await prisma.season.findFirst({
        where: { eventId, isActive: true },
        orderBy: { startDate: "desc" },
      });
      if (!activeSeason) {
        return NextResponse.json({ message: "No active season for this event" }, { status: 404 });
      }
      seasonId = activeSeason.id;
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = registrationSchema.parse(body);

    // Check if event exists and is open
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    const season = await prisma.season.findFirst({
      where: { eventId, isActive: true },
      include: {
        feeScheme: { include: { birdFeeItems: { orderBy: { birdNo: "asc" } }, raceTypeFees: true } },
        bettingScheme: true,
        races: { select: { id: true, raceTypeId: true } },
      },
      orderBy: { startDate: "desc" },
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

    // Check if breeder has already registered for this season with same loft
    const existingRegistration = await prisma.eventInventory.findFirst({
      where: {
        seasonId,
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
      // Bind loft to a real Team row (create if missing) for the Teams page
      const teamId = await resolveTeamId(tx, breederId, validatedData.loftName);

      // Create EventInventory
      const eventInventory = await tx.eventInventory.create({
        data: {
          seasonId,
          breederId,
          teamId,
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
          // Existing bird — verify ownership
          bird = await tx.bird.findUnique({ where: { id: birdData.birdId } });
          if (!bird || bird.breederId !== breederId) {
            throw new Error(`Bird ${birdData.birdId} not found or does not belong to you`);
          }
        } else {
          // New bird — find by band or create
          const band = `${birdData.band1}-${birdData.band2}-${birdData.band3}-${birdData.band4}`;
          bird = await tx.bird.findFirst({ where: { band } });

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
          } else if (bird.breederId !== breederId) {
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

      // Add birds to races still accepting registrations.
      // Track created RaceItem ids so we can attach owner bets to each one.
      const existingRaces = await tx.race.findMany({
        where: { seasonId, status: "REGISTERING" },
        select: { id: true },
      });
      // raceItems per inventory item id (one bird → one RaceItem per race)
      const restingStatus = await tx.birdStatusPreset.findFirst({
        where: { trigger: "REGISTER", isActive: true, OR: [{ seasonId }, { seasonId: null }] },
        orderBy: [{ seasonId: "desc" }, { sortOrder: "asc" }],
        select: { id: true },
      });
      const raceItemsByInventory = new Map<number, number[]>();
      for (const race of existingRaces) {
        for (const item of inventoryItems) {
          const ri = await tx.raceItem.create({
            data: { raceId: race.id, inventoryItemId: item.id, displayStatusId: restingStatus?.id ?? null },
          });
          const list = raceItemsByInventory.get(item.id) ?? [];
          list.push(ri.id);
          raceItemsByInventory.set(item.id, list);
        }
      }

      // Build owner bets (same pools applied to the bird in every race).
      let betStakesTotal = 0;
      const betRows: {
        raceId: number;
        raceItemId: number;
        category: BetCategory;
        tierIndex: number;
        amount: number;
      }[] = [];
      if (validatedData.bets.length > 0 && season?.bettingScheme) {
        const scheme = season.bettingScheme as unknown as Record<string, unknown>;
        for (const sel of validatedData.bets) {
          const invItem = inventoryItems.find((it) => it.birdId === sel.birdId);
          if (!invItem) continue; // bird not part of this registration
          const raceItemIds = raceItemsByInventory.get(invItem.id) ?? [];
          // de-dupe pools per bird
          const seen = new Set<string>();
          for (const pool of sel.pools) {
            const key = `${pool.category}:${pool.tierIndex}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const amount = schemeTierAmount(scheme, pool.category, pool.tierIndex);
            if (amount <= 0) continue; // tier not funded — skip
            // raceItemIds[k] corresponds to existingRaces[k] (built in order)
            existingRaces.forEach((race, k) => {
              const raceItemId = raceItemIds[k];
              if (!raceItemId) return;
              betRows.push({ raceId: race.id, raceItemId, category: pool.category, tierIndex: pool.tierIndex, amount });
              betStakesTotal += amount;
            });
          }
        }
      }

      // Calculate fees and populate EventInventoryItem fee fields
      let feeTotal = 0;
      if (season?.feeScheme) {
        const fees = calculateFees({
          numBirds: validatedData.reservedBirds,
          feeScheme: {
            ...season.feeScheme,
            birdFeeItems: season.feeScheme.birdFeeItems || [],
            raceTypeFees: season.feeScheme.raceTypeFees || [],
          },
          races: season?.races || [],
        });
        feeTotal = fees.total;

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
      }

      // Single PENDING Payment folds registration fees + bet stakes together,
      // so the existing PayPal flow (which charges one pending payment per
      // inventory) collects both at once. Bets link to this payment.
      const grandTotal = feeTotal + betStakesTotal;
      let payment: { id: number } | null = null;
      if (grandTotal > 0) {
        const descParts = [`Registration: ${validatedData.reservedBirds} birds`];
        if (betStakesTotal > 0) descParts.push(`bets: $${betStakesTotal.toFixed(2)}`);
        payment = await tx.payment.create({
          data: {
            eventInventoryId: eventInventory.id,
            breederId,
            paymentValue: grandTotal,
            paymentDate: new Date(),
            paymentTimestamp: new Date(),
            paymentDesc: descParts.join(" + "),
            status: PaymentStatus.PENDING,
          },
        });
      }

      // Persist owner bets under the registering breeder's user id.
      if (betRows.length > 0) {
        await tx.bet.createMany({
          data: betRows.map((b) => ({
            raceId: b.raceId,
            raceItemId: b.raceItemId,
            bettorId: session.user.id,
            ownerUserId: session.user.id,
            category: b.category,
            tierIndex: b.tierIndex,
            amount: b.amount,
            status: "PLACED" as const,
            stakePaymentId: payment?.id,
          })),
        });
      }

      return {
        eventInventory,
        inventoryItems,
        betsPlaced: betRows.length,
        betStakesTotal,
      };
    }, { timeout: 60000, maxWait: 15000 }); // many sequential writes over remote DB exceed the 5s default

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
