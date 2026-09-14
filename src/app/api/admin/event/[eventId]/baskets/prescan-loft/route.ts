import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

// Read-only lookup: given a scanned RFID, report which LOFT basket the bird is
// already assigned to (via BFD "Set Baskets"). Scanning does NOT create
// assignments — it tells the operator where to physically place the bird.
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

    const { rfid } = await request.json();
    if (!rfid || typeof rfid !== "string" || rfid.trim() === "") {
      return NextResponse.json({ message: "rfid is required" }, { status: 400 });
    }
    const tag = rfid.trim();

    // Find the registered inventory item by RFID within this season
    const item = await prisma.eventInventoryItem.findFirst({
      where: { bird: { rfid: tag }, eventInventory: { seasonId } },
      include: {
        bird: { select: { band: true, birdName: true, rfid: true, color: true, sex: true, attention: true, note: true } },
        eventInventory: {
          include: {
            breeder: { select: { firstName: true, lastName: true } },
            team: { select: { name: true } },
          },
        },
        basketAssignments: {
          where: { eventBasket: { phase: "LOFT" } },
          include: { eventBasket: { select: { id: true, label: true, basketNo: true, capacity: true } } },
          take: 1,
        },
      },
    });

    if (!item || !item.bird) {
      return NextResponse.json({ status: "foreign", rfid: tag });
    }

    const breeder = item.eventInventory?.breeder ?? null;
    const loftName = item.eventInventory?.team?.name ?? item.eventInventory?.loft ?? null;
    const assignment = item.basketAssignments[0];

    if (!assignment) {
      return NextResponse.json({ status: "unassigned", bird: item.bird, breeder, loftName });
    }

    const basket = assignment.eventBasket;
    const count = await prisma.basketAssignment.count({ where: { eventBasketId: basket.id } });

    return NextResponse.json({
      status: "placed",
      bird: item.bird,
      breeder,
      loftName,
      basket: {
        label: basket.label ?? `Basket #${basket.basketNo}`,
        basketNo: basket.basketNo,
        capacity: basket.capacity,
        count,
      },
    });
  } catch (error) {
    console.error("prescan-loft error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
