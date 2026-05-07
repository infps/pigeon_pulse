import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

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

    // Flatten nested relations for UI column accessors
    const flattenedRaceItems = raceItems.map((item) => {
      // Compute CHECKED_IN overlay for REGISTERED birds
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
        birdPosition: item.result?.birdPosition ?? null,
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
