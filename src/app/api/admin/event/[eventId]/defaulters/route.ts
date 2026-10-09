import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { computePaymentTotals } from "@/lib/paymentStatus";
import { approvedInventory } from "@/lib/entry-filters";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: eventIdParam } = await params;
  const eventId = parseInt(eventIdParam);
  if (isNaN(eventId)) return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
  const guard = await requirePermission("payments.view");
  if ("error" in guard) return guard.error;

  try {
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

    // Find earliest payment-required race in season
    const paymentRace = await prisma.race.findFirst({
      where: {
        seasonId,
        raceType: { isPaymentRequired: true },
        startTime: { not: null },
      },
      orderBy: { startTime: "asc" },
      select: { startTime: true },
    });

    // Defaulter window: 7 days before earliest payment-required race
    const now = new Date();
    const isInDefaulterWindow = paymentRace?.startTime
      ? now >= new Date(paymentRace.startTime.getTime() - 7 * 24 * 60 * 60 * 1000)
      : false;

    const inventories = await prisma.eventInventory.findMany({
      where: { seasonId, ...approvedInventory },
      select: {
        id: true, breederId: true, loft: true, cashPromised: true,
        breeder: { select: { firstName: true, lastName: true } },
        payments: { select: { paymentValue: true, paymentDesc: true, paymentType: true, status: true } },
        items: {
          select: {
            id: true, birdNo: true, birdId: true,
            entryFeeValue: true, perchFeeValue: true, raceFeeValue: true, hotSpotFeeValue: true,
          },
          orderBy: { birdNo: "asc" },
        },
      },
    });

    const defaulters = inventories
      .map((inv) => {
        const totals = computePaymentTotals(inv.items, inv.payments);
        const isPending = totals.status === "PENDING" || totals.status === "PARTIAL";
        const balanceOwed = totals.balance;

        return {
          eventInventoryId: inv.id,
          breederId: inv.breederId,
          breederName: `${inv.breeder?.firstName ?? ""} ${inv.breeder?.lastName ?? ""}`.trim(),
          loft: inv.loft,
          cashPromised: inv.cashPromised,
          balanceOwed: Math.max(0, balanceOwed),
          birds: inv.items,
          isDefaulter: isPending && isInDefaulterWindow,
        };
      })
      .filter((d) => d.isDefaulter);

    return NextResponse.json({ defaulters, isInDefaulterWindow, paymentRaceDate: paymentRace?.startTime ?? null });
  } catch (error) {
    console.error("Error fetching defaulters:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
