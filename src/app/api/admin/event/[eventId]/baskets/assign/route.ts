import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bfdAssign } from "@/lib/packingEngine";
import type { BreederGroup, BasketSlot } from "@/lib/packingEngine";
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

    // 1. Fetch all registered birds for this event with breeder info
    const inventoryItems = await prisma.eventInventoryItem.findMany({
      where: { eventInventory: { eventId } },
      select: {
        id: true,
        eventInventory: {
          select: {
            breeder: { select: { id: true, lastName: true } },
          },
        },
      },
    });

    if (inventoryItems.length === 0) {
      return NextResponse.json(
        { message: "No registered birds found for this event" },
        { status: 200 }
      );
    }

    // 2. Group items by breederId
    const groupMap = new Map<number, BreederGroup>();
    for (const item of inventoryItems) {
      const breeder = item.eventInventory?.breeder;
      if (!breeder) continue;
      const key = breeder.id;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          breederId: breeder.id,
          lastName: breeder.lastName ?? "Unknown",
          itemIds: [],
        });
      }
      groupMap.get(key)!.itemIds.push(item.id);
    }
    const groups: BreederGroup[] = [...groupMap.values()];

    // 3. Fetch LOFT baskets with current assignment counts
    const eventBaskets = await prisma.eventBasket.findMany({
      where: { eventId, phase: "LOFT" },
      include: { _count: { select: { assignments: true } } },
      orderBy: { basketNo: "asc" },
    });

    if (eventBaskets.length === 0) {
      return NextResponse.json(
        { message: "No loft baskets found. Create baskets first." },
        { status: 400 }
      );
    }

    // Save phase wipes all loft assignments before re-inserting,
    // so packer must treat baskets as empty for both preview and persist.
    const slots: BasketSlot[] = eventBaskets.map((b) => ({
      id: b.id,
      capacity: b.capacity,
      used: 0,
      label: b.label,
      basketNo: b.basketNo,
    }));

    // 4. Run BFD
    const { assigned, unassigned } = bfdAssign(groups, slots);

    const summary = {
      totalBreeders: groups.length,
      assignedBreeders: assigned.length,
      unassignedBreeders: unassigned.length,
      totalBirds: inventoryItems.length,
      assignedBirds: assigned.reduce((sum, a) => sum + a.itemIds.length, 0),
    };

    if (preview) {
      return NextResponse.json({
        preview: true,
        assigned: assigned.map((a) => ({
          breederId: a.breederId,
          lastName: a.lastName,
          basketNo: a.basketNo,
          basketLabel: a.basketLabel,
          birdCount: a.itemIds.length,
        })),
        unassigned: unassigned.map((u) => ({
          breederId: u.breederId,
          lastName: u.lastName,
          birdCount: u.itemIds.length,
        })),
        summary,
      });
    }

    // 5. Persist in transaction
    await prisma.$transaction(async (tx) => {
      // Delete existing LOFT assignments for this event
      const loftBasketIds = eventBaskets.map((b) => b.id);
      await tx.basketAssignment.deleteMany({
        where: { eventBasketId: { in: loftBasketIds } },
      });

      // Create new assignments (one per bird, all in breeder's assigned basket)
      const assignmentData = assigned.flatMap((a) =>
        a.itemIds.map((itemId) => ({
          eventBasketId: a.basketId,
          eventInventoryItemId: itemId,
        }))
      );
      await tx.basketAssignment.createMany({ data: assignmentData });

      // Update RaceItem status to LOFT_BASKETED for assigned birds
      const assignedItemIds = assigned.flatMap((a) => a.itemIds);
      if (assignedItemIds.length > 0) {
        await tx.raceItem.updateMany({
          where: {
            inventoryItemId: { in: assignedItemIds },
            status: { in: ["REGISTERED", "CHECKED_IN"] },
          },
          data: { status: "LOFT_BASKETED" },
        });
      }

      // Reset status for unassigned birds (in case of re-run)
      const unassignedItemIds = unassigned.flatMap((u) => u.itemIds);
      if (unassignedItemIds.length > 0) {
        await tx.raceItem.updateMany({
          where: {
            inventoryItemId: { in: unassignedItemIds },
            status: "LOFT_BASKETED",
          },
          data: { status: "REGISTERED" },
        });
      }
    });

    return NextResponse.json({
      preview: false,
      assigned: assigned.map((a) => ({
        breederId: a.breederId,
        lastName: a.lastName,
        basketNo: a.basketNo,
        basketLabel: a.basketLabel,
        birdCount: a.itemIds.length,
      })),
      unassigned: unassigned.map((u) => ({
        breederId: u.breederId,
        lastName: u.lastName,
        birdCount: u.itemIds.length,
      })),
      summary,
      message: "Baskets assigned successfully",
    });
  } catch (error) {
    console.error("Error in assign baskets:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
