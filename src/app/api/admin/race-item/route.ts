import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireAnyPermission } from "@/lib/authorize";
import { computePaymentTotals } from "@/lib/paymentStatus";
import { openHotspotGate } from "@/lib/hotspot-gates";

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

    const raceItems = await prisma.raceItem.findMany({
      where: {
        raceId: parseInt(raceId),
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
                payments: { select: { status: true } },
              },
            },
            basketAssignments: {
              include: {
                eventBasket: { select: { label: true, phase: true } },
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

    // Hybrid payment status per registration (one query for the whole race).
    // A bird's fees are billed on its registration, so every bird of an
    // unpaid/partial registration is flagged unpaid.
    const inventoryIds = Array.from(
      new Set(raceItems.map((r) => r.inventoryItem?.eventInventoryId).filter((v): v is number => v != null))
    );
    const statusByInventory = new Map<number, string>();
    if (inventoryIds.length > 0) {
      const race = await prisma.race.findUnique({ where: { id: parseInt(raceId) }, select: { seasonId: true } });
      const openGate = race?.seasonId != null ? await openHotspotGate(race.seasonId) : undefined;
      const inventories = await prisma.eventInventory.findMany({
        where: { id: { in: inventoryIds } },
        select: {
          id: true,
          hotspotsPaidMask: true,
          payments: { select: { paymentValue: true, paymentDesc: true, paymentType: true } },
          items: {
            select: {
              entryFeeValue: true, perchFeeValue: true, raceFeeValue: true, hotSpotFeeValue: true,
              hotSpot1FeeValue: true, hotSpot2FeeValue: true, hotSpot3FeeValue: true, hotSpotFinalFeeValue: true,
            },
          },
        },
      });
      for (const inv of inventories) {
        statusByInventory.set(inv.id, computePaymentTotals(inv.items, inv.payments, inv.hotspotsPaidMask, openGate).status);
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
      const loftLabel = assignments.find((a) => a.eventBasket?.phase === "LOFT")?.eventBasket?.label ?? null;
      const raceLabel = assignments.find((a) => a.eventBasket?.phase === "RACE")?.eventBasket?.label ?? null;

      return {
        ...item,
        bird: item.inventoryItem?.bird ?? undefined,
        eventInventoryItem: item.inventoryItem
          ? { eventInventory: item.inventoryItem.eventInventory }
          : undefined,
        status: computedStatus,
        paymentStatus: statusByInventory.get(item.inventoryItem?.eventInventoryId ?? -1) ?? null,
        birdPosition: item.result?.birdPosition ?? null,
        birdPositionHotSpot: item.result?.birdPositionHotSpot ?? null,
        prizeValue: item.result?.prizeValue ?? null,
        birdDrop: item.result?.birdDrop ?? null,
        arrivalTime: item.result?.arrivalTime ?? null,
        groupId: item.result?.groupId ?? null,
        speed: null,
        loftBasketLabel: loftLabel,
        raceBasketLabel: raceLabel,
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
