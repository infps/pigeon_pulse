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

    const items = await prisma.eventInventoryItem.findMany({
      where: { eventInventory: { seasonId } },
      include: {
        bird: { select: { id: true, band: true, birdName: true, rfid: true, color: true, sex: true, attention: true, note: true } },
        eventInventory: {
          include: {
            breeder: { select: { id: true, firstName: true, lastName: true } },
            payments: { select: { status: true, paymentValue: true } },
          },
        },
        currentGroup: { select: { id: true, name: true } },
        basketAssignments: {
          where: { eventBasket: { phase: "LOFT" } },
          include: {
            eventBasket: { select: { label: true } },
          },
          take: 1,
        },
      },
    });

    const enriched = items.map((item) => {
      const hasRfid = item.bird?.rfid != null && item.bird.rfid !== "";
      const hasPaid = item.eventInventory?.payments?.some((p) => p.status === "PAID") ?? false;
      const loftAssignment = item.basketAssignments?.[0];
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
      };
    });

    const checkedIn = enriched.filter((i) => i.isCheckedIn).length;

    return NextResponse.json({
      items: enriched,
      summary: { total: enriched.length, checkedIn, notCheckedIn: enriched.length - checkedIn },
    });
  } catch (error) {
    console.error("Error fetching checkin status:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
