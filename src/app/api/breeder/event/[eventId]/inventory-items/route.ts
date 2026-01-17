import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;

  try {
    const eventInventoryItems = await prisma.eventInventoryItem.findMany({
      where: {
        eventInventory: {
          eventId: eventId,
        },
      },
      include: {
        bird: true,
        eventInventory: {
          include: {
            breeder: true,
          },
        },
      },
      orderBy: {
        eventInventory: {
          registrationDate: "desc",
        },
      },
    });

    return NextResponse.json(
      {
        eventInventoryItems,
        message: "Event inventory items fetched successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching event inventory items:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
