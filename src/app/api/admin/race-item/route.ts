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
              },
            },
          },
        },
        distBasket: true,
        raceBasket: true,
        result: true,
      },
      orderBy: [
        {
          result: {
            birdPosition: "asc",
          },
        },
        {
          result: {
            arrivalTime: "asc",
          },
        },
      ],
    });

    // Flatten nested relations to match UI column accessors
    const flattenedRaceItems = raceItems.map((item) => ({
      ...item,
      bird: item.inventoryItem?.bird ?? undefined,
      eventInventoryItem: item.inventoryItem
        ? { eventInventory: item.inventoryItem.eventInventory }
        : undefined,
      status: item.raceBasketId
        ? "RACE_BASKETED"
        : item.isLost
          ? "FOREIGN_BIRD"
          : item.distBasketId
            ? "LOFT_BASKETED"
            : "REGISTERED",
      birdPosition: item.result?.birdPosition ?? null,
      arrivalTime: item.result?.arrivalTime ?? null,
      speed: null,
      isLoftBasketed: !!item.distBasketId,
      isRaceBasketed: !!item.raceBasketId,
      loftBasket: item.distBasket,
    }));

    return Response.json({ raceItems: flattenedRaceItems });
  } catch (error) {
    console.error("Error fetching race items:", error);
    return Response.json(
      { error: "Failed to fetch race items" },
      { status: 500 }
    );
  }
}
