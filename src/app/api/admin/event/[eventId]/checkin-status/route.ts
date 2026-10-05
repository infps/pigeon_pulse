import { auth } from "@/lib/auth";
import { requireAnyPermission } from "@/lib/authorize";
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
    const guard = await requireAnyPermission(["checkin.view", "checkin.manage"]);
    if ("error" in guard) return guard.error;
    const session = guard.session;

    const { searchParams } = new URL(request.url);
    const seasonIdParam = searchParams.get("seasonId");
    let seasonId: number;
    if (seasonIdParam) {
      seasonId = parseInt(seasonIdParam);
    } else {
      const activeSeason = await prisma.season.findFirst({
        where: { eventId, isActive: true },
        orderBy: { startDate: "desc" },
      });
      if (!activeSeason) {
        return NextResponse.json({ message: "No active season for this event" }, { status: 404 });
      }
      seasonId = activeSeason.id;
    }

    // Optional race scope. Race baskets belong to one race; loft baskets are
    // season-wide (raceId null), so a loft basket matches any race.
    const raceIdParam = searchParams.get("raceId");
    let raceId: number | null = null;
    if (raceIdParam) {
      raceId = parseInt(raceIdParam);
      if (isNaN(raceId)) {
        return NextResponse.json({ message: "Invalid race ID" }, { status: 400 });
      }
    }

    const items = await prisma.eventInventoryItem.findMany({
      where: { eventInventory: { seasonId } },
      include: {
        bird: { select: { id: true, band: true, birdName: true, rfid: true, color: true, sex: true, attention: true, note: true, isLost: true } },
        eventInventory: {
          include: {
            breeder: { select: { id: true, firstName: true, lastName: true } },
            payments: { select: { status: true, paymentValue: true } },
          },
        },
        currentGroup: { select: { id: true, name: true } },
        basketAssignments: {
          where:
            raceId != null
              ? {
                  eventBasket: {
                    OR: [
                      { phase: "LOFT", OR: [{ raceId }, { raceId: null }] },
                      { phase: "RACE", raceId },
                    ],
                  },
                }
              : { eventBasket: { phase: "LOFT" } },
          include: {
            eventBasket: { select: { label: true, basketNo: true, phase: true, raceId: true } },
          },
          orderBy: { assignedAt: "desc" },
          ...(raceId == null ? { take: 1 } : {}),
        },
      },
    });

    const enriched = items.map((item) => {
      const hasRfid = item.bird?.rfid != null && item.bird.rfid !== "";
      const hasPaid = item.eventInventory?.payments?.some((p) => p.status === "PAID") ?? false;
      const loftAssignments = item.basketAssignments.filter((a) => a.eventBasket.phase === "LOFT");
      // Prefer a loft basket tied to this race over a season-wide one.
      const loftAssignment =
        loftAssignments.find((a) => a.eventBasket.raceId != null) ?? loftAssignments[0];
      const raceAssignment = item.basketAssignments.find((a) => a.eventBasket.phase === "RACE");
      return {
        id: item.id,
        birdId: item.birdId,
        bird: item.bird,
        breeder: item.eventInventory?.breeder,
        isCheckedIn: hasRfid && hasPaid,
        hasRfid,
        hasPaid,
        loftBasketLabel: loftAssignment?.eventBasket?.label ?? null,
        isLoftBasketed: !!loftAssignment,
        loftBasketNo: loftAssignment?.eventBasket?.basketNo ?? null,
        loftAssignedAt: loftAssignment?.assignedAt ?? null,
        raceBasketLabel: raceAssignment?.eventBasket?.label ?? null,
        raceBasketNo: raceAssignment?.eventBasket?.basketNo ?? null,
        raceAssignedAt: raceAssignment?.assignedAt ?? null,
        isRaceBasketed: !!raceAssignment,
        isLost: item.bird?.isLost === 1,
      };
    });

    const checkedIn = enriched.filter((i) => i.isCheckedIn).length;

    return NextResponse.json({
      items: enriched,
      summary: {
        total: enriched.length,
        checkedIn,
        notCheckedIn: enriched.length - checkedIn,
        loftBasketed: enriched.filter((i) => i.isLoftBasketed).length,
        raceBasketed: enriched.filter((i) => i.isRaceBasketed).length,
      },
    });
  } catch (error) {
    console.error("Error fetching checkin status:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
