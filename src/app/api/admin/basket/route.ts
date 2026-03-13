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

    const baskets = await prisma.basket.findMany({
      where: {
        raceId: parseInt(raceId),
      },
      include: {
        _count: {
          select: {
            raceItems: true,
            distItems: true,
          },
        },
      },
      orderBy: {
        basketNo: "asc",
      },
    });

    return Response.json({ baskets });
  } catch (error) {
    console.error("Error fetching baskets:", error);
    return Response.json(
      { error: "Failed to fetch baskets" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session || !session.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { raceId, basketNo, isRaceBasket } = body;

    if (!raceId || basketNo === undefined) {
      return Response.json(
        { error: "Race ID and basket number are required" },
        { status: 400 }
      );
    }

    const raceIdInt = parseInt(raceId);
    const isRaceBasketInt = isRaceBasket ? 1 : 0;

    // Check if basket number already exists for this race
    const existingBasket = await prisma.basket.findFirst({
      where: {
        raceId: raceIdInt,
        basketNo,
        isRaceBasket: isRaceBasketInt,
      },
    });

    if (existingBasket) {
      return Response.json(
        { error: "Basket number already exists for this type" },
        { status: 400 }
      );
    }

    const basket = await prisma.basket.create({
      data: {
        raceId: raceIdInt,
        basketNo,
        isRaceBasket: isRaceBasketInt,
      },
      include: {
        _count: {
          select: {
            raceItems: true,
            distItems: true,
          },
        },
      },
    });

    return Response.json({ basket }, { status: 201 });
  } catch (error) {
    console.error("Error creating basket:", error);
    return Response.json(
      { error: "Failed to create basket" },
      { status: 500 }
    );
  }
}
