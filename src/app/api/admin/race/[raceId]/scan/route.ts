import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { presetIdFor } from "@/lib/birdStatus";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const scanSchema = z.object({
  ringNo: z.string(),
  timestamp: z.string(),
  antenna: z.string().optional(),
});

function parseTimestamp(ts: string): Date {
  return new Date(
    parseInt(ts.substring(0, 4)),
    parseInt(ts.substring(4, 6)) - 1,
    parseInt(ts.substring(6, 8)),
    parseInt(ts.substring(8, 10)),
    parseInt(ts.substring(10, 12)),
    parseInt(ts.substring(12, 14)),
  );
}

async function assignDefaulterGroup(seasonId: number | null, inventoryItemId: number | null, userId: string | null | undefined) {
  if (!inventoryItemId || !seasonId) return;
  let defaulterGroup = await prisma.eventGroup.findFirst({
    where: { seasonId, type: "DEFAULTER" },
  });
  if (!defaulterGroup) {
    defaulterGroup = await prisma.eventGroup.create({
      data: { seasonId, name: "Defaulters", type: "DEFAULTER", hasCapacity: false },
    });
  }
  await prisma.eventInventoryItem.update({
    where: { id: inventoryItemId },
    data: { statusGroupId: defaulterGroup.id },
  });
  await prisma.birdEventHistory.create({
    data: {
      eventInventoryItemId: inventoryItemId,
      action: "STATUS_CHANGED",
      detail: "Marked as FOREIGN_BIRD (Defaulter)",
      groupId: defaulterGroup.id,
      performedById: userId ?? null,
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ raceId: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { raceId } = await params;
    const raceIdInt = parseInt(raceId);
    const body = await request.json();

    const validatedData = scanSchema.parse(body);
    const { ringNo, timestamp } = validatedData;

    const race = await prisma.race.findUnique({
      where: { id: raceIdInt },
    });

    if (!race) {
      return NextResponse.json(
        { message: "Race not found" },
        { status: 404 }
      );
    }

    // Find the bird by band or rfid
    let bird = await prisma.bird.findFirst({
      where: { OR: [{ band: ringNo }, { rfid: ringNo }] },
    });

    // Find the race item for this bird in this race
    let raceItem = bird
      ? await prisma.raceItem.findFirst({
          where: { raceId: raceIdInt, inventoryItem: { birdId: bird.id } },
        })
      : null;

    // Unknown bird or unregistered bird → register as foreign bird
    if (!bird || !raceItem) {
      // Re-check: bird may exist (created by prior scan) but have no raceItem yet
      if (bird) {
        raceItem = await prisma.raceItem.findFirst({
          where: { raceId: raceIdInt, inventoryItem: { birdId: bird.id } },
        });
      }
      if (raceItem) {
        return NextResponse.json({
          raceItem,
          message: "Bird already marked as foreign bird",
          isNewScan: false,
          scanType: "foreign",
        });
      }

      const arrivalTime = parseTimestamp(timestamp);
      const { foreignRaceItem, invItemId } = await prisma.$transaction(async (tx) => {
        if (!bird) {
          bird = await tx.bird.create({
            data: { band: ringNo, rfid: ringNo },
          });
        }
        const eventInv = await tx.eventInventory.create({
          data: { seasonId: race.seasonId },
        });
        const invItem = await tx.eventInventoryItem.create({
          data: { birdId: bird.id, eventInventoryId: eventInv.id },
        });
        const ri = await tx.raceItem.create({
          data: {
            raceId: raceIdInt,
            inventoryItemId: invItem.id,
            status: "FOREIGN_BIRD",
            raceBasketTime: arrivalTime,
          },
        });
        await tx.raceItemResult.create({
          data: { raceItemId: ri.id, arrivalTime },
        });
        return { foreignRaceItem: ri, invItemId: invItem.id };
      });

      await assignDefaulterGroup(race.seasonId, invItemId, session?.user?.id);

      return NextResponse.json({
        raceItem: foreignRaceItem,
        message: `Unknown bird ${ringNo} registered as foreign`,
        isNewScan: true,
        scanType: "foreign",
      });
    }

    const isLive = race.status === "STARTED" || race.status === "ENDED";

    // Pre-race scan (loft basketing)
    if (!isLive) {
      if (raceItem.status === "LOFT_BASKETED") {
        return NextResponse.json(
          {
            raceItem,
            message: "Bird already loft-basketted",
            isNewScan: false,
            scanType: "loft",
          },
          { status: 200 }
        );
      }

      const updatedRaceItem = await prisma.raceItem.update({
        where: { id: raceItem.id },
        data: { status: "LOFT_BASKETED" },
        include: {
          inventoryItem: {
            include: {
              bird: {
                include: {
                  breeder: {
                    select: { firstName: true, lastName: true, email: true },
                  },
                },
              },
            },
          },
        },
      });

      return NextResponse.json(
        {
          raceItem: updatedRaceItem,
          message: "Bird added to loft",
          isNewScan: true,
          scanType: "loft",
        },
        { status: 200 }
      );
    }

    // Already processed
    if (raceItem.status === "ARRIVED" || raceItem.status === "FOREIGN_BIRD") {
      return NextResponse.json(
        {
          raceItem,
          message: raceItem.status === "FOREIGN_BIRD" ? "Bird already marked as foreign bird" : "Bird already arrived",
          isNewScan: false,
          scanType: raceItem.status === "FOREIGN_BIRD" ? "foreign" : "arrival",
        },
        { status: 200 }
      );
    }

    const arrivalTime = parseTimestamp(timestamp);

    // Race already ended → foreign bird (arrived after race closed)
    if (race.status === "ENDED") {
      const updatedRaceItem = await prisma.raceItem.update({
        where: { id: raceItem.id },
        data: { status: "FOREIGN_BIRD", raceBasketTime: arrivalTime },
        include: {
          inventoryItem: {
            include: {
              bird: {
                include: {
                  breeder: {
                    select: { firstName: true, lastName: true, email: true },
                  },
                },
              },
            },
          },
        },
      });

      await assignDefaulterGroup(race.seasonId, raceItem.inventoryItemId, session?.user?.id);

      return NextResponse.json(
        {
          raceItem: updatedRaceItem,
          message: "Bird marked as foreign bird (arrived after race ended)",
          isNewScan: true,
          scanType: "foreign",
        },
        { status: 200 }
      );
    }

    // Live race scan (STARTED) → arrival with ranking
    const arrivedCount = await prisma.raceItem.count({
      where: { raceId: raceIdInt, status: "ARRIVED" },
    });
    const birdPosition = arrivedCount + 1;
    const arrivedStatusId = await presetIdFor(race.seasonId, "ARRIVE");

    const updatedRaceItem = await prisma.raceItem.update({
      where: { id: raceItem.id },
      data: { status: "ARRIVED", raceBasketTime: arrivalTime, displayStatusId: arrivedStatusId },
      include: {
        inventoryItem: {
          include: {
            bird: {
              include: {
                breeder: {
                  select: { firstName: true, lastName: true, email: true },
                },
              },
            },
          },
        },
      },
    });

    await prisma.raceItemResult.upsert({
      where: { raceItemId: raceItem.id },
      create: { raceItemId: raceItem.id, arrivalTime, birdPosition },
      update: { arrivalTime, birdPosition },
    });

    await prisma.birdEventHistory.create({
      data: {
        eventInventoryItemId: raceItem.inventoryItemId!,
        action: "ARRIVED",
        detail: `Arrived at position ${birdPosition}, race ${raceId}`,
        performedById: session?.user?.id ?? null,
      },
    });

    // Auto STATUS group: if birdPosition matches a BirdStatusCode, assign it
    const statusCode = await prisma.birdStatusCode.findFirst({
      where: { code: birdPosition },
    });
    if (statusCode) {
      let statusGroup = await prisma.eventGroup.findFirst({
        where: { seasonId: race.seasonId ?? undefined, type: "STATUS", statusCodeId: statusCode.id },
      });
      if (!statusGroup) {
        statusGroup = await prisma.eventGroup.create({
          data: {
            seasonId: race.seasonId!,
            name: statusCode.label,
            type: "STATUS",
            statusCodeId: statusCode.id ?? undefined,
            color: statusCode.color ?? undefined,
            hasCapacity: false,
          },
        });
      }
      await prisma.eventInventoryItem.update({
        where: { id: raceItem.inventoryItemId! },
        data: { statusGroupId: statusGroup.id },
      });
      await prisma.birdEventHistory.create({
        data: {
          eventInventoryItemId: raceItem.inventoryItemId!,
          action: "STATUS_CHANGED",
          detail: `Status set to: ${statusCode.label} (code ${statusCode.code})`,
          groupId: statusGroup.id,
          performedById: session?.user?.id ?? null,
        },
      });
    }

    return NextResponse.json(
      {
        raceItem: updatedRaceItem,
        message: "Arrival recorded successfully",
        isNewScan: true,
        scanType: "arrival",
        birdPosition,
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
