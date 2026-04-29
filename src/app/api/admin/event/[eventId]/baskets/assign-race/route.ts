import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomAssign } from "@/lib/packingEngine";
import type { RaceItem, BasketSlot } from "@/lib/packingEngine";
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
    const preview = body.preview === true;

    // 1. Source pool — birds currently loft-basketed
    const loftAssignments = await prisma.basketAssignment.findMany({
      where: { eventBasket: { eventId, phase: "LOFT" } },
      include: {
        inventoryItem: {
          include: {
            eventInventory: {
              include: { breeder: { select: { lastName: true } } },
            },
          },
        },
      },
    });

    if (loftAssignments.length === 0) {
      return NextResponse.json(
        { message: "No loft-basketed birds found. Assign loft baskets first." },
        { status: 400 }
      );
    }

    const items: RaceItem[] = loftAssignments.map((a) => ({
      id: a.eventInventoryItemId,
      breederLastName: a.inventoryItem?.eventInventory?.breeder?.lastName ?? "Unknown",
    }));

    // 2. Target race baskets
    const raceBaskets = await prisma.eventBasket.findMany({
      where: { eventId, phase: "RACE" },
      include: { _count: { select: { assignments: true } } },
      orderBy: { basketNo: "asc" },
    });

    if (raceBaskets.length === 0) {
      return NextResponse.json(
        { message: "No race baskets found. Create race baskets first." },
        { status: 400 }
      );
    }

    // Fresh-start distribution: treat all race baskets as empty
    const slots: BasketSlot[] = raceBaskets.map((b) => ({
      id: b.id,
      capacity: b.capacity,
      used: 0,
      label: b.label,
      basketNo: b.basketNo,
    }));

    // 3. Run random assignment
    const { assigned, unassigned } = randomAssign(items, slots);

    const totalCapacity = slots.reduce((s, b) => s + b.capacity, 0);
    const assignedBirds = assigned.reduce((sum, a) => sum + a.itemIds.length, 0);

    const summary = {
      totalBirds: items.length,
      totalCapacity,
      assignedBirds,
      unassignedBirds: unassigned.length,
      basketCount: raceBaskets.length,
    };

    const basketDetails = raceBaskets.map((rb) => {
      const assignment = assigned.find((a) => a.basketId === rb.id);
      return {
        basketId: rb.id,
        basketNo: rb.basketNo,
        basketLabel: rb.label,
        capacity: rb.capacity,
        birdCount: assignment?.itemIds.length ?? 0,
        breeders: assignment?.breeders ?? [],
      };
    });

    if (preview) {
      return NextResponse.json({
        preview: true,
        baskets: basketDetails,
        unassigned: unassigned.length,
        summary,
      });
    }

    // 4. Persist — wipe existing RACE assignments, then reseed
    await prisma.$transaction(async (tx) => {
      const raceBasketIds = raceBaskets.map((b) => b.id);
      await tx.basketAssignment.deleteMany({
        where: { eventBasketId: { in: raceBasketIds } },
      });

      const assignmentData = assigned.flatMap((a) =>
        a.itemIds.map((itemId) => ({
          eventBasketId: a.basketId,
          eventInventoryItemId: itemId,
        }))
      );
      if (assignmentData.length > 0) {
        await tx.basketAssignment.createMany({ data: assignmentData });
      }
    });

    return NextResponse.json({
      preview: false,
      baskets: basketDetails,
      unassigned: unassigned.length,
      summary,
      message: "Race baskets assigned successfully",
    });
  } catch (error) {
    console.error("Error assigning race baskets:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
