import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventInventoryId: string }> }
) {
  const { eventInventoryId: eventInventoryIdParam } = await params;
  const eventInventoryId = parseInt(eventInventoryIdParam);

  if (isNaN(eventInventoryId)) {
    return NextResponse.json({ message: "Invalid event inventory ID" }, { status: 400 });
  }

  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session || !session.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const eventInventory = await prisma.eventInventory.findUnique({
      where: { id: eventInventoryId },
      include: {
        breeder: true,
        season: {
          include: {
            bettingScheme: true,
            feeScheme: { include: { birdFeeItems: true } },
          },
        },
        payments: { orderBy: { paymentDate: "desc" } },
        partners: { include: { breeder: true } },
        items: { include: { bird: true }, orderBy: { birdNo: "asc" } },
      },
    });

    if (!eventInventory) {
      return NextResponse.json({ message: "Event inventory not found" }, { status: 404 });
    }

    // Merge items from sibling records (same breeder + event, different inventory ID)
    if (eventInventory.breederId && eventInventory.seasonId) {
      const siblings = await prisma.eventInventory.findMany({
        where: {
          breederId: eventInventory.breederId,
          seasonId: eventInventory.seasonId,
          id: { not: eventInventoryId },
        },
        include: { items: { include: { bird: true }, orderBy: { birdNo: "asc" } } },
      });
      if (siblings.length > 0) {
        const extraItems = siblings.flatMap((s) => s.items);
        (eventInventory as any).items = [...eventInventory.items, ...extraItems];
      }
    }

    return NextResponse.json({ eventInventory, message: "Event inventory fetched successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error fetching event inventory:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
