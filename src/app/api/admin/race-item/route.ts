import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const raceId = searchParams.get("raceId");

    if (!raceId) {
      return Response.json({ error: "Race ID is required" }, { status: 400 });
    }

    const raceItems = await prisma.raceItem.findMany({
      where: {
        raceId,
      },
      include: {
        bird: {
          include: {
            breeder: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        eventInventoryItem: {
          include: {
            eventInventory: {
              select: {
                loft: true,
              },
            },
          },
        },
        loftBasket: true,
        raceBasket: true,
      },
      orderBy: [
        {
          birdPosition: "asc",
        },
        {
          arrivalTime: "asc",
        },
      ],
    });

    return Response.json({ raceItems });
  } catch (error) {
    console.error("Error fetching race items:", error);
    return Response.json(
      { error: "Failed to fetch race items" },
      { status: 500 }
    );
  }
}
