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
    const mode: "shuffle" | "assign" = body.mode === "assign" ? "assign" : "shuffle";
    const raceId = body.raceId ? parseInt(body.raceId) : undefined;

    // 1. Fetch birds for this season
    const inventoryItems = await prisma.eventInventoryItem.findMany({
      where: {
        eventInventory: { seasonId },
        ...(mode === "assign" ? { basketAssignments: { none: {} } } : {}),
      },
      select: {
        id: true,
        currentGroupId: true,
        eventInventory: {
          select: {
            breeder: { select: { id: true, lastName: true } },
          },
        },
      },
    });

    if (inventoryItems.length === 0) {
      return NextResponse.json(
        { message: "No registered birds found for this season" },
        { status: 200 }
      );
    }

    // 2. Resolve group names for display
    const groupIds = [...new Set(inventoryItems.map((i) => i.currentGroupId).filter(Boolean))] as number[];
    const groupNameMap = new Map<number, string>(); // groupId → name
    if (groupIds.length > 0) {
      const groups = await prisma.eventGroup.findMany({
        where: { id: { in: groupIds } },
        select: { id: true, name: true },
      });
      for (const g of groups) groupNameMap.set(g.id, g.name);
    }

    // 3. Build assignment groups:
    //    - Birds WITH currentGroupId → group by group (keep together)
    //    - Birds WITHOUT currentGroupId → group by breederId
    //    Use negative keys for groups to avoid collision with breeder IDs.
    const groupMap = new Map<number, BreederGroup>();
    for (const item of inventoryItems) {
      let key: number;
      let lastName: string;

      if (item.currentGroupId) {
        key = -item.currentGroupId; // negative = group key
        lastName = groupNameMap.get(item.currentGroupId) ?? `Group ${item.currentGroupId}`;
      } else {
        const breeder = item.eventInventory?.breeder;
        if (!breeder) continue;
        key = breeder.id;
        lastName = breeder.lastName ?? "Unknown";
      }

      if (!groupMap.has(key)) {
        groupMap.set(key, { breederId: key, lastName, itemIds: [] });
      }
      groupMap.get(key)!.itemIds.push(item.id);
    }
    const groups: BreederGroup[] = [...groupMap.values()];

    // 4. Fetch LOFT baskets scoped to season (+ raceId if provided)
    const eventBaskets = await prisma.eventBasket.findMany({
      where: {
        seasonId,
        phase: "LOFT",
        ...(raceId ? { raceId } : {}),
      },
      include: { _count: { select: { assignments: true } } },
      orderBy: { basketNo: "asc" },
    });

    if (eventBaskets.length === 0) {
      return NextResponse.json(
        { message: "No loft baskets found. Create baskets first." },
        { status: 400 }
      );
    }

    const slots: BasketSlot[] = eventBaskets.map((b) => ({
      id: b.id,
      capacity: b.capacity,
      used: mode === "assign" ? (b._count?.assignments ?? 0) : 0,
      label: b.label,
      basketNo: b.basketNo,
    }));

    // 5. Run BFD
    const { assigned, unassigned } = bfdAssign(groups, slots);

    const summary = {
      totalGroups: groups.length,
      assignedGroups: assigned.length,
      unassignedGroups: unassigned.length,
      totalBirds: inventoryItems.length,
      assignedBirds: assigned.reduce((sum, a) => sum + a.itemIds.length, 0),
    };

    if (preview) {
      return NextResponse.json({
        preview: true,
        assigned: assigned.map((a) => ({
          groupKey: a.breederId,
          label: a.lastName,
          basketNo: a.basketNo,
          basketLabel: a.basketLabel,
          birdCount: a.itemIds.length,
        })),
        unassigned: unassigned.map((u) => ({
          groupKey: u.breederId,
          label: u.lastName,
          birdCount: u.itemIds.length,
        })),
        summary,
      });
    }

    // 6. Persist
    await prisma.$transaction(async (tx) => {
      if (mode === "shuffle") {
        const loftBasketIds = eventBaskets.map((b) => b.id);
        await tx.basketAssignment.deleteMany({
          where: { eventBasketId: { in: loftBasketIds } },
        });
      }

      const assignmentData = assigned.flatMap((a) =>
        a.itemIds.map((itemId) => ({
          eventBasketId: a.basketId,
          eventInventoryItemId: itemId,
        }))
      );
      await tx.basketAssignment.createMany({ data: assignmentData });

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
        groupKey: a.breederId,
        label: a.lastName,
        basketNo: a.basketNo,
        basketLabel: a.basketLabel,
        birdCount: a.itemIds.length,
      })),
      unassigned: unassigned.map((u) => ({
        groupKey: u.breederId,
        label: u.lastName,
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
