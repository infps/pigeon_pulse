import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: eventIdParam } = await params;
  const eventId = parseInt(eventIdParam);

  if (isNaN(eventId)) {
    return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
  }

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { eventInventoryItemId, rfid, capacity } = body;

    if (!eventInventoryItemId || !rfid || typeof rfid !== "string" || rfid.trim() === "") {
      return NextResponse.json(
        { message: "eventInventoryItemId and rfid are required" },
        { status: 400 }
      );
    }

    const cap = parseInt(capacity) || 10;

    // Validate item belongs to event
    const item = await prisma.eventInventoryItem.findFirst({
      where: {
        id: eventInventoryItemId,
        eventInventory: { eventId },
      },
      include: {
        bird: { select: { id: true, band: true, birdName: true, rfid: true } },
        eventInventory: {
          include: {
            breeder: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!item || !item.bird) {
      return NextResponse.json(
        { message: "Bird not found for this event" },
        { status: 404 }
      );
    }

    // Already has loft basket? Skip + return info
    const existingAssignment = await prisma.basketAssignment.findFirst({
      where: {
        eventInventoryItemId: item.id,
        eventBasket: { eventId, phase: "LOFT" },
      },
      include: {
        eventBasket: { select: { id: true, basketNo: true, label: true, capacity: true } },
      },
    });

    if (existingAssignment) {
      return NextResponse.json({
        message: "Bird already assigned to loft basket",
        alreadyAssigned: true,
        basket: existingAssignment.eventBasket,
      });
    }

    // All in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Link RFID to bird (skip if already has same RFID)
      if (item.bird!.rfid !== rfid.trim()) {
        // Check RFID not used by another bird
        const existing = await tx.bird.findFirst({
          where: { rfid: rfid.trim(), id: { not: item.bird!.id } },
        });
        if (existing) {
          throw new Error(`RFID "${rfid}" already linked to another bird (ID: ${existing.id})`);
        }
        await tx.bird.update({
          where: { id: item.bird!.id },
          data: { rfid: rfid.trim() },
        });
      }

      // 2. Get breeder lastName for label
      const lastName = item.eventInventory?.breeder?.lastName ?? "Unknown";

      // 3. Find existing LOFT baskets for this breeder (by label prefix)
      const labelPrefix = `LB-${lastName.toUpperCase()}-`;
      const existingBaskets = await tx.eventBasket.findMany({
        where: {
          eventId,
          phase: "LOFT",
          label: { startsWith: labelPrefix },
        },
        include: { _count: { select: { assignments: true } } },
        orderBy: { basketNo: "asc" },
      });

      // 4. Find basket with space, or create new one
      let targetBasket = existingBaskets.find(
        (b) => (b._count?.assignments ?? 0) < b.capacity
      );

      if (!targetBasket) {
        // Get next basketNo for this event's LOFT phase
        const maxBasket = await tx.eventBasket.findFirst({
          where: { eventId, phase: "LOFT" },
          orderBy: { basketNo: "desc" },
          select: { basketNo: true },
        });
        const nextNo = (maxBasket?.basketNo ?? 0) + 1;
        const labelIndex = existingBaskets.length + 1;

        targetBasket = await tx.eventBasket.create({
          data: {
            eventId,
            basketNo: nextNo,
            capacity: cap,
            phase: "LOFT",
            label: `${labelPrefix}${labelIndex}`,
          },
          include: { _count: { select: { assignments: true } } },
        });
      }

      // 5. Create assignment
      const assignment = await tx.basketAssignment.create({
        data: {
          eventBasketId: targetBasket.id,
          eventInventoryItemId: item.id,
        },
      });

      // 6. Update RaceItem status → LOFT_BASKETED
      await tx.raceItem.updateMany({
        where: {
          inventoryItemId: item.id,
          status: { in: ["REGISTERED", "CHECKED_IN"] },
        },
        data: { status: "LOFT_BASKETED" },
      });

      return {
        basket: {
          id: targetBasket.id,
          basketNo: targetBasket.basketNo,
          label: targetBasket.label,
          capacity: targetBasket.capacity,
        },
        assignmentId: assignment.id,
        rfid: rfid.trim(),
        birdId: item.bird!.id,
      };
    });

    return NextResponse.json({
      message: "Bird scanned and assigned to loft basket",
      ...result,
    });
  } catch (error: any) {
    console.error("Error in scan-loft:", error);
    if (error.message?.includes("RFID")) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
