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

export async function POST(
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

    const body = await request.json();
    const capacity = parseInt(body.capacity);

    if (isNaN(capacity) || capacity < 1) {
      return NextResponse.json({ message: "Capacity must be a positive integer" }, { status: 400 });
    }

    // Auto-compute next basketNo for LOFT phase
    const maxBasket = await prisma.eventBasket.findFirst({
      where: { eventId, phase: "LOFT" },
      orderBy: { basketNo: "desc" },
      select: { basketNo: true },
    });
    const basketNo = (maxBasket?.basketNo ?? 0) + 1;

    const basket = await prisma.eventBasket.create({
      data: {
        eventId,
        basketNo,
        capacity,
        phase: "LOFT",
        label: null,
      },
      include: { _count: { select: { assignments: true } } },
    });

    return NextResponse.json({ basket }, { status: 201 });
  } catch (error) {
    console.error("Error creating loft basket:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
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

    const body = await request.json();
    const basketId = parseInt(body.basketId);

    if (isNaN(basketId)) {
      return NextResponse.json({ message: "Invalid basket ID" }, { status: 400 });
    }

    // Verify basket belongs to this event and is LOFT phase
    const basket = await prisma.eventBasket.findFirst({
      where: { id: basketId, eventId, phase: "LOFT" },
      include: { _count: { select: { assignments: true } } },
    });

    if (!basket) {
      return NextResponse.json({ message: "Basket not found" }, { status: 404 });
    }

    if ((basket._count?.assignments ?? 0) > 0) {
      return NextResponse.json({ message: "Cannot delete basket with assigned birds" }, { status: 409 });
    }

    await prisma.eventBasket.delete({ where: { id: basketId } });

    return NextResponse.json({ message: "Basket deleted" });
  } catch (error) {
    console.error("Error deleting loft basket:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
