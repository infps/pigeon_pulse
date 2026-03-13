import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !session.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { raceItemIds, basketId, basketType } = body;

    if (!raceItemIds || !Array.isArray(raceItemIds) || raceItemIds.length === 0) {
      return NextResponse.json(
        { error: "raceItemIds array is required" },
        { status: 400 }
      );
    }

    if (!basketId) {
      return NextResponse.json(
        { error: "basketId is required" },
        { status: 400 }
      );
    }

    if (!basketType || !["loft", "race"].includes(basketType)) {
      return NextResponse.json(
        { error: "basketType must be either 'loft' or 'race'" },
        { status: 400 }
      );
    }

    const basketIdInt = parseInt(basketId);
    const raceItemIdInts = raceItemIds.map((id: string | number) => parseInt(String(id)));

    // Verify basket exists and belongs to the correct race
    const basket = await prisma.basket.findUnique({
      where: { id: basketIdInt },
      include: { race: true },
    });

    if (!basket) {
      return NextResponse.json(
        { error: "Basket not found" },
        { status: 404 }
      );
    }

    // Verify basket type matches (isRaceBasket is Int: 1=race, 0/null=dist)
    if (basketType === "race" && basket.isRaceBasket !== 1) {
      return NextResponse.json(
        { error: "Basket is not a race basket" },
        { status: 400 }
      );
    }

    if (basketType === "loft" && basket.isRaceBasket === 1) {
      return NextResponse.json(
        { error: "Basket is not a loft basket" },
        { status: 400 }
      );
    }

    // Verify all race items exist and belong to the same race as basket
    const raceItems = await prisma.raceItem.findMany({
      where: {
        id: { in: raceItemIdInts },
      },
    });

    if (raceItems.length !== raceItemIdInts.length) {
      return NextResponse.json(
        { error: "Some race items not found" },
        { status: 404 }
      );
    }

    const mismatchedItems = raceItems.filter(
      (item) => item.raceId !== basket.raceId
    );

    if (mismatchedItems.length > 0) {
      return NextResponse.json(
        { error: "All race items must belong to the same race as the basket" },
        { status: 400 }
      );
    }

    // Update race items with basket assignment
    const updateData =
      basketType === "loft"
        ? {
            distBasketId: basketIdInt,
            isDistBasketed: 1,
          }
        : {
            raceBasketId: basketIdInt,
            raceBasketTime: new Date(),
          };

    await prisma.raceItem.updateMany({
      where: {
        id: { in: raceItemIdInts },
      },
      data: updateData,
    });

    // Fetch updated race items
    const updatedRaceItems = await prisma.raceItem.findMany({
      where: {
        id: { in: raceItemIdInts },
      },
      include: {
        inventoryItem: {
          include: {
            bird: {
              include: {
                breeder: true,
              },
            },
            eventInventory: true,
          },
        },
        distBasket: true,
        raceBasket: true,
      },
    });

    return NextResponse.json({
      message: "Race items basketed successfully",
      data: updatedRaceItems,
    });
  } catch (error) {
    console.error("Error basketing race items:", error);
    return NextResponse.json(
      { error: "Failed to basket race items" },
      { status: 500 }
    );
  }
}

// Remove race items from basket
export async function DELETE(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !session.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { raceItemIds, basketType } = body;

    if (!raceItemIds || !Array.isArray(raceItemIds) || raceItemIds.length === 0) {
      return NextResponse.json(
        { error: "raceItemIds array is required" },
        { status: 400 }
      );
    }

    if (!basketType || !["loft", "race"].includes(basketType)) {
      return NextResponse.json(
        { error: "basketType must be either 'loft' or 'race'" },
        { status: 400 }
      );
    }

    const raceItemIdInts = raceItemIds.map((id: string | number) => parseInt(String(id)));

    // Update race items to remove basket assignment
    const updateData =
      basketType === "loft"
        ? {
            distBasketId: null,
            isDistBasketed: 0,
          }
        : {
            raceBasketId: null,
            raceBasketTime: null,
          };

    await prisma.raceItem.updateMany({
      where: {
        id: { in: raceItemIdInts },
      },
      data: updateData,
    });

    return NextResponse.json({
      message: "Race items removed from basket successfully",
    });
  } catch (error) {
    console.error("Error removing race items from basket:", error);
    return NextResponse.json(
      { error: "Failed to remove race items from basket" },
      { status: 500 }
    );
  }
}
