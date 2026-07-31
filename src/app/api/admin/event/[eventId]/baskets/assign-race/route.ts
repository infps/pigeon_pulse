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

    const body = await request.json();
    const preview = body.preview === true;
    const mode: "reset" | "incremental" = body.mode === "incremental" ? "incremental" : "reset";
    const raceIdRaw = body.raceId;
    const raceId =
      raceIdRaw === undefined || raceIdRaw === null || raceIdRaw === ""
        ? NaN
        : parseInt(String(raceIdRaw));

    if (isNaN(raceId)) {
      return NextResponse.json(
        { message: "raceId is required" },
        { status: 400 }
      );
    }

    // 1. Source pool — birds currently loft-basketed
    const loftAssignments = await prisma.basketAssignment.findMany({
      where: { eventBasket: { seasonId, phase: "LOFT" } },
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

    // 2. Target race baskets — scoped to this race
    const raceBaskets = await prisma.eventBasket.findMany({
      where: { seasonId, phase: "RACE", raceId },
      include: {
        _count: { select: { assignments: true } },
        assignments: {
          include: {
            inventoryItem: {
              include: {
                eventInventory: {
                  include: { breeder: { select: { lastName: true } } },
                },
              },
            },
          },
        },
      },
      orderBy: { basketNo: "asc" },
    });

    if (raceBaskets.length === 0) {
      return NextResponse.json(
        { message: "No race baskets found for this race. Create race baskets first." },
        { status: 400 }
      );
    }

    // 3. Build source items
    let items: RaceItem[];
    let slots: BasketSlot[];

    if (mode === "incremental") {
      // Exclude items already assigned to ANY basket of THIS race
      const alreadyAssigned = new Set<number>();
      for (const rb of raceBaskets) {
        for (const a of rb.assignments) alreadyAssigned.add(a.eventInventoryItemId);
      }
      items = loftAssignments
        .filter((a) => !alreadyAssigned.has(a.eventInventoryItemId))
        .map((a) => ({
          id: a.eventInventoryItemId,
          breederLastName: a.inventoryItem?.eventInventory?.breeder?.lastName ?? "Unknown",
        }));

      slots = raceBaskets.map((b) => ({
        id: b.id,
        capacity: b.capacity,
        used: b.assignments.length,
        label: b.label,
        basketNo: b.basketNo,
        existingBreeders: b.assignments
          .map((a) => a.inventoryItem?.eventInventory?.breeder?.lastName ?? "Unknown")
          .filter(Boolean) as string[],
      }));
    } else {
      items = loftAssignments.map((a) => ({
        id: a.eventInventoryItemId,
        breederLastName: a.inventoryItem?.eventInventory?.breeder?.lastName ?? "Unknown",
      }));
      slots = raceBaskets.map((b) => ({
        id: b.id,
        capacity: b.capacity,
        used: 0,
        label: b.label,
        basketNo: b.basketNo,
      }));
    }

    // 4. Run random assignment
    const { assigned, unassigned } = randomAssign(items, slots);

    const totalCapacity = slots.reduce((s, b) => s + b.capacity, 0);
    const assignedBirds = assigned.reduce((sum, a) => sum + a.itemIds.length, 0);
    const existingTotal =
      mode === "incremental"
        ? raceBaskets.reduce((s, b) => s + b.assignments.length, 0)
        : 0;

    const summary = {
      totalBirds: items.length + existingTotal,
      totalCapacity,
      assignedBirds: assignedBirds + existingTotal,
      unassignedBirds: unassigned.length,
      basketCount: raceBaskets.length,
      mode,
    };

    const basketDetails = raceBaskets.map((rb) => {
      const assignment = assigned.find((a) => a.basketId === rb.id);
      const newCount = assignment?.itemIds.length ?? 0;
      const existingCount = mode === "incremental" ? rb.assignments.length : 0;
      const existingBreeders =
        mode === "incremental"
          ? rb.assignments
              .map((a) => a.inventoryItem?.eventInventory?.breeder?.lastName ?? "Unknown")
              .filter(Boolean)
          : [];
      const breeders = Array.from(
        new Set([...(existingBreeders as string[]), ...(assignment?.breeders ?? [])])
      );
      return {
        basketId: rb.id,
        basketNo: rb.basketNo,
        basketLabel: rb.label,
        capacity: rb.capacity,
        birdCount: newCount + existingCount,
        breeders,
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

    // 5. Persist
    await prisma.$transaction(async (tx) => {
      const raceBasketIds = raceBaskets.map((b) => b.id);
      if (mode === "reset") {
        await tx.basketAssignment.deleteMany({
          where: { eventBasketId: { in: raceBasketIds } },
        });
      }

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
      message:
        mode === "incremental"
          ? "New birds added to race baskets"
          : "Race baskets assigned successfully",
    });
  } catch (error) {
    console.error("Error assigning race baskets:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
