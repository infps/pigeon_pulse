import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: eventIdParam } = await params;
  const eventId = parseInt(eventIdParam);

  if (isNaN(eventId)) {
    return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
  }

  try {
    const eventInventory = await prisma.eventInventory.findMany({
      where: { eventId },
      include: {
        breeder: true,
        items: {
          include: { bird: true },
        },
      },
      orderBy: { signInDate: "desc" },
    });

    return NextResponse.json(
      { eventInventory, message: "Event inventory fetched successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching event inventory:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
