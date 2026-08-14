import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: eventIdParam } = await params;
  const eventId = parseInt(eventIdParam);
  if (isNaN(eventId)) return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const seasonIdParam = url.searchParams.get("seasonId");
    let seasonId: number;
    if (seasonIdParam) {
      seasonId = parseInt(seasonIdParam);
    } else {
      const activeSeason = await prisma.season.findFirst({
        where: { eventId, isActive: true },
        orderBy: { startDate: "desc" },
      });
      if (!activeSeason) return NextResponse.json({ message: "No active season" }, { status: 404 });
      seasonId = activeSeason.id;
    }

    const body = await request.json();
    const { rfid, raceId, action } = body;
    if (!rfid || !raceId) return NextResponse.json({ message: "rfid and raceId required" }, { status: 400 });

    // Register a foreign bird under the admin's breeder record for later reassignment
    if (action === "register_foreign") {
      const adminUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { breeder: { select: { id: true } } },
      });
      if (!adminUser?.breeder) {
        return NextResponse.json({ message: "Admin has no breeder profile. Create one first." }, { status: 409 });
      }
      const breederId = adminUser.breeder.id;

      const result = await prisma.$transaction(async (tx) => {
        let bird = await tx.bird.findFirst({ where: { rfid: rfid.trim() } });
        if (!bird) {
          bird = await tx.bird.create({ data: { rfid: rfid.trim(), band: rfid.trim(), breederId } });
        }
        let inv = await tx.eventInventory.findFirst({ where: { seasonId, breederId } });
        if (!inv) {
          inv = await tx.eventInventory.create({ data: { seasonId, breederId } });
        }
        const invItem = await tx.eventInventoryItem.create({
          data: { birdId: bird.id, eventInventoryId: inv.id },
        });
        const ri = await tx.raceItem.create({
          data: { raceId: parseInt(String(raceId)), inventoryItemId: invItem.id, status: "REGISTERED" },
        });
        return { bird, raceItemId: ri.id };
      });

      return NextResponse.json({ status: "registered", bird: result.bird, raceItemId: result.raceItemId });
    }

    // Find bird by RFID
    const bird = await prisma.bird.findFirst({
      where: { rfid: rfid.trim() },
      select: { id: true, birdName: true, band: true, rfid: true, attention: true },
    });

    if (!bird) {
      return NextResponse.json({ status: "foreign", rfid: rfid.trim() });
    }

    // Find the race item for this bird in this race
    const raceItem = await prisma.raceItem.findFirst({
      where: { raceId: parseInt(String(raceId)), inventoryItem: { birdId: bird.id } },
      include: {
        inventoryItem: {
          include: {
            basketAssignments: {
              include: { eventBasket: { select: { id: true, label: true, basketNo: true, phase: true } } },
              where: { eventBasket: { phase: "RACE", raceId: parseInt(String(raceId)) } },
              take: 1,
            },
          },
        },
      },
    });

    if (!raceItem) {
      // Bird exists but not registered for this race → foreign
      return NextResponse.json({ status: "foreign", rfid: rfid.trim(), bird });
    }

    // Already basketed
    if (raceItem.status === "LOFT_BASKETED") {
      const basket = raceItem.inventoryItem?.basketAssignments?.[0]?.eventBasket;
      return NextResponse.json({
        status: "already_scanned",
        bird,
        basketLabel: basket?.label ?? `#${basket?.basketNo ?? "?"}`,
        basketNo: basket?.basketNo,
      });
    }

    // Update status → LOFT_BASKETED
    await prisma.raceItem.update({
      where: { id: raceItem.id },
      data: { status: "LOFT_BASKETED" },
    });

    const basket = raceItem.inventoryItem?.basketAssignments?.[0]?.eventBasket;

    return NextResponse.json({
      status: "scanned",
      bird,
      basketLabel: basket?.label ?? (basket ? `#${basket.basketNo}` : "Unassigned"),
      basketNo: basket?.basketNo ?? null,
    });
  } catch (error) {
    console.error("prescan-race error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

// Remove a foreign bird's raceItem (created via register_foreign)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: eventIdParam } = await params;
  if (isNaN(parseInt(eventIdParam))) return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { raceItemId } = await request.json();
    if (!raceItemId) return NextResponse.json({ message: "raceItemId required" }, { status: 400 });

    await prisma.raceItem.delete({ where: { id: raceItemId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("prescan-race DELETE error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
