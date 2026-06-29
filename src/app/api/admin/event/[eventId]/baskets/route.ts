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
    const raceIdParam = searchParams.get("raceId");

    const where: { eventId: number; phase?: "LOFT" | "RACE"; raceId?: number } = { eventId };
    if (phase === "LOFT" || phase === "RACE") {
      where.phase = phase;
    }
    if (phase === "RACE" && raceIdParam) {
      const rId = parseInt(raceIdParam);
      if (!isNaN(rId)) where.raceId = rId;
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
    const phase: "LOFT" | "RACE" = body.phase === "RACE" ? "RACE" : "LOFT";
    const raceIdRaw = body.raceId;
    const raceId =
      raceIdRaw === undefined || raceIdRaw === null || raceIdRaw === ""
        ? null
        : parseInt(String(raceIdRaw));

    if (isNaN(capacity) || capacity < 1) {
      return NextResponse.json({ message: "Capacity must be a positive integer" }, { status: 400 });
    }

    if (phase === "RACE") {
      if (raceId === null || isNaN(raceId)) {
        return NextResponse.json(
          { message: "raceId is required for RACE phase baskets" },
          { status: 400 }
        );
      }
    }

    // basketNo is unique per (eventId, phase) due to schema constraint —
    // compute globally across all races within the phase.
    const maxBasket = await prisma.eventBasket.findFirst({
      where: { eventId, phase },
      orderBy: { basketNo: "desc" },
      select: { basketNo: true },
    });
    const basketNo = (maxBasket?.basketNo ?? 0) + 1;

    const basket = await prisma.eventBasket.create({
      data: {
        eventId,
        basketNo,
        capacity,
        phase,
        label: null,
        raceId: phase === "RACE" ? raceId : null,
      },
      include: { _count: { select: { assignments: true } } },
    });

    return NextResponse.json({ basket }, { status: 201 });
  } catch (error) {
    console.error("Error creating basket:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
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

    const basket = await prisma.eventBasket.findFirst({
      where: { id: basketId, eventId },
      include: { _count: { select: { assignments: true } } },
    });
    if (!basket) {
      return NextResponse.json({ message: "Basket not found" }, { status: 404 });
    }

    const data: { label?: string | null; capacity?: number } = {};

    if (body.label !== undefined) {
      data.label = body.label === "" ? null : String(body.label).trim();
    }
    if (body.capacity !== undefined) {
      const cap = parseInt(body.capacity);
      if (isNaN(cap) || cap < 1) {
        return NextResponse.json({ message: "Capacity must be a positive integer" }, { status: 400 });
      }
      if (cap < (basket._count?.assignments ?? 0)) {
        return NextResponse.json(
          { message: `Cannot set capacity below current bird count (${basket._count?.assignments})` },
          { status: 409 }
        );
      }
      data.capacity = cap;
    }

    const updated = await prisma.eventBasket.update({
      where: { id: basketId },
      data,
      include: { _count: { select: { assignments: true } } },
    });

    return NextResponse.json({ basket: updated });
  } catch (error) {
    console.error("Error updating basket:", error);
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

    // Verify basket belongs to this event
    const basket = await prisma.eventBasket.findFirst({
      where: { id: basketId, eventId },
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
    console.error("Error deleting basket:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
