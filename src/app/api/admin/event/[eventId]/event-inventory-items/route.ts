import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;

  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session || !session.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // For ADMIN, check if they own the event
    if (session.user.role === "ADMIN") {
      const event = await prisma.event.findFirst({
        where: {
          eventId: eventId,
          createdById: session.user.id,
        },
      });
      if (!event) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
      }
    }

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
