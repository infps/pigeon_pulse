import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
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
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const phase = searchParams.get("phase"); // "LOFT" | "RACE" | null

    const where: { eventId: number; phase?: "LOFT" | "RACE" } = { eventId };
    if (phase === "LOFT" || phase === "RACE") {
      where.phase = phase;
    }

    const baskets = await prisma.eventBasket.findMany({
      where,
      include: {
        _count: { select: { assignments: true } },
        assignments: {
          include: {
            inventoryItem: {
              include: {
                bird: { select: { id: true, band: true, birdName: true, rfid: true } },
                eventInventory: {
                  include: {
                    breeder: { select: { id: true, firstName: true, lastName: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ phase: "asc" }, { basketNo: "asc" }],
    });

    return NextResponse.json({ baskets });
  } catch (error) {
    console.error("Error fetching event baskets:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
