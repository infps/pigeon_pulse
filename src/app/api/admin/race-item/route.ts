import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireAnyPermission } from "@/lib/authorize";

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    const guard = await requireAnyPermission(["races.view", "races.manage"]);
    if ("error" in guard) return guard.error;
    if (!session || !session.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const raceId = searchParams.get("raceId");

    if (!raceId) {
      return Response.json({ error: "Race ID is required" }, { status: 400 });
    }

    const raceIdInt = parseInt(raceId);

    const raceItems = await prisma.raceItem.findMany({
      where: {
        raceId: raceIdInt,
      },
      include: {
        inventoryItem: {
          include: {
            bird: {
              include: {
                breeder: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
            eventInventory: {
              select: {
                loft: true,
                breeder: { select: { id: true, firstName: true, lastName: true } },
                payments: { select: { status: true } },
              },
            },
            basketAssignments: {
              include: {
                eventBasket: {
                  select: { id: true, label: true, basketNo: true, phase: true, raceId: true },
                },
              },
            },
          },
        },
        result: true,
      },
      orderBy: [
        { result: { birdPosition: "asc" } },
        { result: { arrivalTime: "asc" } },
      ],
    });

    // Pulling-flight count per bird — HayLoft's PULLING_FLIGHTS subquery, which
    // counted this bird's race items on race type 4. Race types are
    // user-configurable here, so the pulling types are resolved by name rather
    // than by a hardcoded id, and the whole thing is one grouped query instead
    // of a correlated subquery per row.
    const inventoryItemIds = raceItems
      .map((i) => i.inventoryItemId)
      .filter((id): id is number => id != null);

    const pullingCounts = new Map<number, number>();
    if (inventoryItemIds.length > 0) {
      const pullingTypes = await prisma.raceType.findMany({
        where: { name: { contains: "pull", mode: "insensitive" } },
        select: { id: true },
      });
      if (pullingTypes.length > 0) {
        const grouped = await prisma.raceItem.groupBy({
          by: ["inventoryItemId"],
          where: {
            inventoryItemId: { in: inventoryItemIds },
            race: { raceTypeId: { in: pullingTypes.map((t) => t.id) } },
          },
          _count: { _all: true },
        });
        for (const g of grouped) {
          if (g.inventoryItemId != null) pullingCounts.set(g.inventoryItemId, g._count._all);
        }
      }
    }

    // Flatten nested relations for UI column accessors
    const flattenedRaceItems = raceItems.map((item) => {
      // CHECKED_IN is persisted when the RFID tag is linked. This overlay stays
      // only to cover birds checked in before that became the case — it never
      // overrides a status the workflow has already recorded.
      let computedStatus: string = item.status;
      if (computedStatus === "REGISTERED") {
        const hasRfid = item.inventoryItem?.bird?.rfid != null && item.inventoryItem.bird.rfid !== "";
        const hasPaid = item.inventoryItem?.eventInventory?.payments?.some((p) => p.status === "PAID") ?? false;
        if (hasRfid && hasPaid) computedStatus = "CHECKED_IN";
      }

      const assignments = item.inventoryItem?.basketAssignments ?? [];
      // Loft baskets are per-race in this schema, so a bird can hold loft
      // assignments for several races at once — only this race's counts.
      const loftBasket = assignments.find(
        (a) =>
          a.eventBasket?.phase === "LOFT" &&
          (a.eventBasket.raceId === raceIdInt || a.eventBasket.raceId === null)
      )?.eventBasket;
      const raceBasket = assignments.find(
        (a) => a.eventBasket?.phase === "RACE" && a.eventBasket.raceId === raceIdInt
      )?.eventBasket;

      const breeder =
        item.inventoryItem?.eventInventory?.breeder ?? item.inventoryItem?.bird?.breeder ?? null;

      return {
        ...item,
        bird: item.inventoryItem?.bird ?? undefined,
        eventInventoryItem: item.inventoryItem
          ? { eventInventory: item.inventoryItem.eventInventory }
          : undefined,
        status: computedStatus,
        birdPosition: item.result?.birdPosition ?? null,
        birdPositionHotSpot: item.result?.birdPositionHotSpot ?? null,
        prizeValue: item.result?.prizeValue ?? null,
        birdDrop: item.result?.birdDrop ?? null,
        arrivalTime: item.result?.arrivalTime ?? null,
        groupId: item.result?.groupId ?? null,
        speed: null,
        loftBasketLabel: loftBasket?.label ?? null,
        raceBasketLabel: raceBasket?.label ?? null,
        // HayLoft's basketing grid worked in basket numbers, not labels.
        loftBasketNo: loftBasket?.basketNo ?? null,
        raceBasketNo: raceBasket?.basketNo ?? null,
        // IS_DIST_BASKETED: the bird was actually scanned into its loft basket,
        // which is a separate fact from having been allocated one.
        isLoftBasketed: computedStatus === "LOFT_BASKETED" ||
          computedStatus === "RELEASED" ||
          computedStatus === "ARRIVED",
        entryFeePaid: item.inventoryItem?.entryFeePaid ?? null,
        breederName: breeder
          ? [breeder.lastName, breeder.firstName].filter(Boolean).join(", ")
          : null,
        breederId: breeder && "id" in breeder ? breeder.id : null,
        loft: item.inventoryItem?.eventInventory?.loft ?? null,
        pullingCount: item.inventoryItemId != null
          ? pullingCounts.get(item.inventoryItemId) ?? 0
          : 0,
      };
    });

    return Response.json({ raceItems: flattenedRaceItems });
  } catch (error) {
    console.error("Error fetching race items:", error);
    return Response.json(
      { error: "Failed to fetch race items" },
      { status: 500 }
    );
  }
}
